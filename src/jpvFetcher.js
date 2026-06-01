// japierdolevid.com video API'sinden periyodik olarak yeni içerik çekip Discord'a gönderir.
// Kimlik doğrulama: e-posta + şifre ile /auth/token çağrılır, dönen api_key (X-API-Key) kullanılır,
// 401 olunca otomatik yeniden kimlik doğrulanır. Sadece JPV_EMAIL + JPV_PASSWORD tanımlıysa çalışır.
//
// Davranış: İLK çalışmada video listesindeki son N (varsayılan 10) videoyu ekler; sonraki turlarda
// yalnızca yeni eklenenleri gönderir. Görülen en yüksek video id'si dosyaya kaydedilir (yeniden
// başlatınca tekrar göndermez). Her video kendi metadata.type'ına göre ilgili kanala yönlendirilir.

import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { dirname } from "path";
import { processContent } from "./process.js";

const EMAIL = process.env.JPV_EMAIL?.trim();
const PASS = process.env.JPV_PASSWORD?.trim();
const BASE = (process.env.JPV_API_BASE?.trim() || "https://japierdolevid.com/api/v1").replace(/\/$/, "");
const INTERVAL_MS = (Number(process.env.JPV_POLL_MIN) || 5) * 60 * 1000;
const SEED_COUNT = Number(process.env.JPV_SEED_COUNT) || 10;
const STATE_FILE = process.env.JPV_STATE_FILE?.trim() || "data/jpv-state.json";

export function fetcherEnabled() {
  return Boolean(EMAIL && PASS);
}

// ───────────────────── Durum (kalıcı) ─────────────────────
function loadState() {
  try {
    return JSON.parse(readFileSync(STATE_FILE, "utf8"));
  } catch {
    return { maxId: 0 };
  }
}
function saveState(s) {
  try {
    mkdirSync(dirname(STATE_FILE), { recursive: true });
    writeFileSync(STATE_FILE, JSON.stringify(s));
  } catch (e) {
    console.error("[JPV] durum kaydedilemedi:", e.message);
  }
}
let state = loadState();

// ───────────────────── Kimlik doğrulama ─────────────────────
let apiKey = null;

async function authenticate() {
  const r = await fetch(`${BASE}/auth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: EMAIL, password: PASS }),
  });
  if (!r.ok) throw new Error(`auth ${r.status} ${await r.text().catch(() => "")}`);
  const d = await r.json();
  apiKey = d?.tokens?.api_key;
  if (!apiKey) throw new Error("Yanıtta api_key yok");
  return apiKey;
}

// X-API-Key ile GET; 401 olursa bir kez yeniden kimlik doğrulayıp tekrar dener.
async function apiGet(path) {
  if (!apiKey) await authenticate();
  let r = await fetch(`${BASE}${path}`, { headers: { "X-API-Key": apiKey } });
  if (r.status === 401) {
    await authenticate();
    r = await fetch(`${BASE}${path}`, { headers: { "X-API-Key": apiKey } });
  }
  return r;
}

// ───────────────────── Video -> payload eşleştirme ─────────────────────
// Dil değeri olarak ISO kodu (büyük harf) kullanılır: tur -> TUR, eng -> ENG.
// "und"/boş (belirsiz, genelde orijinal ses) -> "Original".
function lang(c) {
  const code = String(c || "").toLowerCase();
  if (!code || code === "und") return "Original";
  return code.toUpperCase();
}
const QR = { "4k": 2160, "2160p": 2160, "1440p": 1440, "1080p": 1080, "720p": 720, "480p": 480, "360p": 360 };
const qrank = (q) => QR[String(q).toLowerCase()] || parseInt(q) || 0;
function humanDuration(s) {
  s = Number(s) || 0;
  if (!s) return undefined;
  const h = Math.floor(s / 3600), m = Math.round((s % 3600) / 60);
  return (h ? `${h}sa ` : "") + `${m}dk`;
}

// Eksiksiz (gerçek) bir içerik mi? (çöp/yarım yüklemeleri eler)
function isComplete(v) {
  const m = v.metadata || {};
  const q = (v.available_qualities || []).filter((x) => x.status === "completed");
  return Boolean((m.title || v.title) && (m.poster_url || m.cover_url) && q.length);
}

function mapVideo(v) {
  const m = v.metadata || {};
  let title = m.original_title || m.title || v.title;
  if (m.type === "series" && (m.season || m.episode)) {
    title += ` · S${String(m.season || 0).padStart(2, "0")}B${String(m.episode || 0).padStart(2, "0")}`;
  }
  const quals = (v.available_qualities || [])
    .filter((x) => x.status === "completed")
    .map((x) => x.quality)
    .sort((a, b) => qrank(b) - qrank(a));
  const audio = (v.audio_languages || [])
    .map((a) => {
      const s = lang(a.language);
      return a.is_original && s !== "Original" ? `${s} (Original)` : s;
    })
    .join(", ");
  const subs = (v.subtitle_languages || []).map((s) => lang(s.language || s)).join(", ");

  return {
    type: m.type, // movie / series ... -> config.js kanal yönlendirmesi
    title,
    description: m.overview || undefined,
    image: m.cover_url || m.poster_url || v.thumbnail_url || undefined, // yatay kapak önceliği
    url: v.embed_url,
    year: m.year || undefined,
    quality: quals.join(", ") || undefined,
    audio: audio || undefined,
    subtitles: subs || undefined,
    duration: humanDuration(v.duration),
    id: m.tmdb_id ? `tmdb:${m.tmdb_id}` : String(v.id),
  };
}

// ───────────────────── Çekme/gönderme ─────────────────────
async function poll() {
  const r = await apiGet(`/videos?limit=50`);
  if (!r.ok) {
    console.error(`[JPV] liste çekilemedi: ${r.status}`);
    return;
  }
  const d = await r.json();
  const items = (d.data || []).filter(isComplete).sort((a, b) => b.id - a.id); // yeni -> eski
  if (!items.length) return;

  let toPost;
  if (!state.maxId) {
    // İlk çalışma: video listesindeki son N videoyu ekle.
    toPost = items.slice(0, SEED_COUNT);
    console.log(`[JPV] ilk çalışma: son ${toPost.length} video ekleniyor.`);
  } else {
    toPost = items.filter((v) => v.id > state.maxId);
  }

  toPost = toPost.sort((a, b) => a.id - b.id); // eskiden yeniye gönder (akış doğru görünsün)
  for (const v of toPost) {
    try {
      const payload = mapVideo(v);
      const { route } = await processContent(payload);
      state.maxId = Math.max(state.maxId || 0, v.id);
      saveState(state);
      console.log(`[JPV] eklendi -> [${route.label}] ${payload.title}`);
    } catch (e) {
      console.error(`[JPV] gönderim hatası (${v.id}):`, e.message);
    }
  }
}

// Manuel test: en son N eksiksiz içeriği (durumdan bağımsız) gönderir.
export async function postLatest(count = 1) {
  const r = await apiGet(`/videos?limit=50`);
  if (!r.ok) throw new Error(`çekilemedi: ${r.status}`);
  const d = await r.json();
  const items = (d.data || []).filter(isComplete).sort((a, b) => b.id - a.id).slice(0, count);
  const sent = [];
  for (const v of items) {
    const { route, content } = await processContent(mapVideo(v));
    sent.push({ title: content.title, channel: route.label });
  }
  return sent;
}

export function startFetcher() {
  if (!fetcherEnabled()) {
    console.log("ℹ️  JPV fetcher kapalı (JPV_EMAIL / JPV_PASSWORD yok).");
    return;
  }
  console.log(`📡 JPV fetcher açık: her ${Math.round(INTERVAL_MS / 60000)} dk` +
    (state.maxId ? ` (son görülen id: ${state.maxId})` : ` (ilk turda son ${SEED_COUNT} video eklenecek)`));
  const run = () => poll().catch((e) => console.error("[JPV]", e.message));
  setTimeout(run, 5000);
  setInterval(run, INTERVAL_MS);
}
