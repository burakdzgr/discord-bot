// japierdolevid.com video API'sinden periyodik olarak yeni içerik çekip Discord'a gönderir.
// Kimlik doğrulama: e-posta + şifre ile /auth/token çağrılır, dönen api_key (X-API-Key) kullanılır,
// 401 olunca otomatik yeniden kimlik doğrulanır. Sadece JPV_EMAIL + JPV_PASSWORD tanımlıysa çalışır.

import { processContent } from "./process.js";

const EMAIL = process.env.JPV_EMAIL?.trim();
const PASS = process.env.JPV_PASSWORD?.trim();
const BASE = (process.env.JPV_API_BASE?.trim() || "https://japierdolevid.com/api/v1").replace(/\/$/, "");
const INTERVAL_MS = (Number(process.env.JPV_POLL_MIN) || 5) * 60 * 1000;
// Çekilecek türler ve karşılık gelen bizim "type" değerimiz: "movie:Movie,series:Series"
const TYPES = (process.env.JPV_TYPES?.trim() || "movie:Movie,series:Series")
  .split(",")
  .map((p) => {
    const [src, target] = p.split(":").map((s) => s.trim());
    return src ? { src, target: target || src } : null;
  })
  .filter(Boolean);

export function fetcherEnabled() {
  return Boolean(EMAIL && PASS);
}

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
const LANG = {
  tur: "Türkçe", eng: "İngilizce", en: "İngilizce", und: "Orijinal", mul: "Çok dilli",
  ja: "Japonca", jpn: "Japonca", kor: "Korece", ger: "Almanca", de: "Almanca",
  fre: "Fransızca", fr: "Fransızca", spa: "İspanyolca", rus: "Rusça", ara: "Arapça", ita: "İtalyanca",
};
const lang = (c) => LANG[String(c || "").toLowerCase()] || String(c || "").toUpperCase();
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

function mapVideo(v, targetType) {
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
    .map((a) => lang(a.language) + (a.is_original ? " (orijinal)" : ""))
    .join(", ");
  const subs = (v.subtitle_languages || []).map((s) => lang(s.language || s)).join(", ");

  return {
    type: targetType, // bizim kanal türümüz (Movie/Series/...)
    title,
    description: m.overview || undefined,
    image: m.cover_url || m.poster_url || v.thumbnail_url || undefined,
    url: v.embed_url,
    year: m.year || undefined,
    quality: quals.join(", ") || undefined,
    audio: audio || undefined,
    subtitles: subs || undefined,
    duration: humanDuration(v.duration),
    id: m.tmdb_id ? `tmdb:${m.tmdb_id}` : String(v.id),
    isNew: true,
  };
}

// ───────────────────── Çekme/gönderme ─────────────────────
const lastSeen = new Map(); // src türü -> görülen en yüksek video id

async function pollType({ src, target }) {
  const r = await apiGet(`/videos?type=${encodeURIComponent(src)}&limit=50`);
  if (!r.ok) {
    console.error(`[JPV] ${src} çekilemedi: ${r.status}`);
    return;
  }
  const d = await r.json();
  const items = (d.data || []).filter(isComplete).sort((a, b) => b.id - a.id); // yeni -> eski

  if (!lastSeen.has(src)) {
    // İlk tur: geçmişi göndermeyelim (spam olmasın), sadece en yüksek id'yi işaretle.
    if (items.length) lastSeen.set(src, items[0].id);
    console.log(`[JPV] ${src} başlangıç işaretlendi: son id ${items[0]?.id ?? "-"} (geçmiş atlanmadı)`);
    return;
  }

  const prev = lastSeen.get(src);
  const fresh = items.filter((v) => v.id > prev).sort((a, b) => a.id - b.id); // eski -> yeni gönder
  for (const v of fresh) {
    try {
      const payload = mapVideo(v, target);
      const { route } = await processContent(payload);
      lastSeen.set(src, Math.max(lastSeen.get(src), v.id));
      console.log(`[JPV] yeni ${src} -> [${route.label}] ${payload.title}`);
    } catch (e) {
      console.error(`[JPV] gönderim hatası (${v.id}):`, e.message);
    }
  }
}

// En son N eksiksiz içeriği (lastSeen'e bakmadan) gönderir — TEST/manuel tetik için.
export async function postLatest(src = "movie", target = "Movie", count = 1) {
  const r = await apiGet(`/videos?type=${encodeURIComponent(src)}&limit=50`);
  if (!r.ok) throw new Error(`çekilemedi: ${r.status}`);
  const d = await r.json();
  const items = (d.data || []).filter(isComplete).sort((a, b) => b.id - a.id).slice(0, count);
  const sent = [];
  for (const v of items) {
    const payload = mapVideo(v, target);
    const { route } = await processContent(payload);
    sent.push({ title: payload.title, channel: route.label });
  }
  return sent;
}

export function startFetcher() {
  if (!fetcherEnabled()) {
    console.log("ℹ️  JPV fetcher kapalı (JPV_EMAIL / JPV_PASSWORD yok).");
    return;
  }
  console.log(`📡 JPV fetcher açık: [${TYPES.map((t) => `${t.src}→${t.target}`).join(", ")}], her ${Math.round(INTERVAL_MS / 60000)} dk.`);
  const run = () => TYPES.forEach((t) => pollType(t).catch((e) => console.error("[JPV]", e.message)));
  setTimeout(run, 5000);
  setInterval(run, INTERVAL_MS);
}
