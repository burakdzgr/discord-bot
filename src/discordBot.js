// Bot Token tabanlı işlemler (webhook'un yapamadıkları):
//  - Forum kanalının etiketlerini (available_tags) okuyup ad -> ID haritası kurmak
//  - En çok beğeni alan postlara "Trending" etiketini periyodik uygulamak
// Sadece BOT_TOKEN ve FORUM_CHANNEL_ID tanımlıysa devreye girer; yoksa bot sadece webhook ile çalışır.

const API = "https://discord.com/api/v10";
const TOKEN = process.env.BOT_TOKEN?.trim();
const CHANNEL_ID = process.env.FORUM_CHANNEL_ID?.trim();
const TRENDING_TAG = (process.env.TRENDING_TAG_NAME || "Trending").trim();
const TRENDING_TOP_N = Number(process.env.TRENDING_TOP_N) || 10;
const TRENDING_INTERVAL_MS = (Number(process.env.TRENDING_INTERVAL_MIN) || 30) * 60 * 1000;

let tagMap = new Map(); // normalize(ad) -> etiket ID
let guildId = null;
let ready = false;

export function botEnabled() {
  return Boolean(TOKEN && CHANNEL_ID);
}

function normalize(s) {
  return String(s).toLowerCase().replace(/\s+/g, "");
}
function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// Discord REST çağrısı (basit 429 rate-limit yeniden denemesiyle).
async function api(path, options = {}) {
  const res = await fetch(`${API}${path}`, {
    ...options,
    headers: { Authorization: `Bot ${TOKEN}`, "Content-Type": "application/json", ...(options.headers || {}) },
  });
  if (res.status === 429) {
    const retry = Number(res.headers.get("retry-after")) || 1;
    await sleep((retry + 0.5) * 1000);
    return api(path, options);
  }
  return res;
}

// Başlangıçta kanal bilgisini çekip etiket adı -> ID haritasını kurar.
export async function initBot() {
  if (!botEnabled()) {
    console.log("ℹ️  Bot Token yok — etiket/Trending kapalı (yalnızca webhook çalışıyor).");
    return;
  }
  try {
    const res = await api(`/channels/${CHANNEL_ID}`);
    if (!res.ok) throw new Error(`kanal alınamadı: ${res.status} ${await res.text().catch(() => "")}`);
    const ch = await res.json();
    guildId = ch.guild_id;
    const tags = ch.available_tags || [];
    tagMap = new Map(tags.map((t) => [normalize(t.name), t.id]));
    ready = true;
    console.log(`🏷️  Etiketler yüklendi (${tagMap.size}): ${tags.map((t) => t.name).join(", ") || "(yok)"}`);

    if (tagMap.has(normalize(TRENDING_TAG))) {
      startTrendingLoop();
    } else {
      console.log(`ℹ️  "${TRENDING_TAG}" etiketi kanalda bulunamadı — Trending otomasyonu kapalı.`);
    }
  } catch (err) {
    console.error("❌ Bot init hatası:", err.message, "— etiketler olmadan devam ediliyor.");
  }
}

// Verilen etiket adlarından (kanalda var olanları) ID listesi üretir (forum sınırı: max 5).
export function tagIdsFor(names) {
  if (!ready || !Array.isArray(names)) return [];
  const ids = [];
  for (const name of names) {
    const id = tagMap.get(normalize(name));
    if (id && !ids.includes(id)) ids.push(id);
  }
  return ids.slice(0, 5);
}

// ───────────────────────── Trending otomasyonu ─────────────────────────

function startTrendingLoop() {
  const dk = Math.round(TRENDING_INTERVAL_MS / 60000);
  console.log(`🔥 Trending açık: her ${dk} dk, en çok beğeni alan ilk ${TRENDING_TOP_N} post etiketlenir.`);
  setTimeout(() => runTrending(), 15000); // ilk turu biraz geciktir
  setInterval(() => runTrending(), TRENDING_INTERVAL_MS);
}

function runTrending() {
  updateTrending().catch((e) => console.error("🔥 Trending hatası:", e.message));
}

// Forum kanalındaki post'ları (aktif + son arşivlenenler) toplar.
async function listForumThreads() {
  const threads = new Map(); // id -> thread

  try {
    const r = await api(`/guilds/${guildId}/threads/active`);
    if (r.ok) {
      const d = await r.json();
      for (const t of d.threads || []) if (t.parent_id === CHANNEL_ID) threads.set(t.id, t);
    }
  } catch (e) {
    console.error("aktif thread listesi:", e.message);
  }

  try {
    const r = await api(`/channels/${CHANNEL_ID}/threads/archived/public?limit=100`);
    if (r.ok) {
      const d = await r.json();
      for (const t of d.threads || []) threads.set(t.id, t);
    }
  } catch (e) {
    console.error("arşiv thread listesi:", e.message);
  }

  return [...threads.values()];
}

// Bir forum postunun ilk mesajındaki toplam tepki (beğeni) sayısı.
// Forum postunun ilk mesajının ID'si, post (thread) ID'si ile aynıdır.
async function reactionCount(threadId) {
  const r = await api(`/channels/${threadId}/messages/${threadId}`);
  if (!r.ok) return 0;
  const m = await r.json();
  return (m.reactions || []).reduce((sum, re) => sum + (re.count || 0), 0);
}

async function patchTags(threadId, appliedTags) {
  const r = await api(`/channels/${threadId}`, {
    method: "PATCH",
    body: JSON.stringify({ applied_tags: appliedTags }),
  });
  if (!r.ok) console.error(`tag güncelleme (${threadId}): ${r.status} ${await r.text().catch(() => "")}`);
}

async function updateTrending() {
  if (!ready) return;
  const trendingId = tagMap.get(normalize(TRENDING_TAG));
  if (!trendingId) return;

  const threads = await listForumThreads();
  if (!threads.length) return;

  // Her postun beğenisini sırayla say (rate-limit dostu).
  const scored = [];
  for (const t of threads) {
    scored.push({ thread: t, count: await reactionCount(t.id) });
  }
  scored.sort((a, b) => b.count - a.count);

  // En çok beğeni alan ilk N (en az 1 beğenisi olanlar).
  const topIds = new Set(
    scored.slice(0, TRENDING_TOP_N).filter((s) => s.count > 0).map((s) => s.thread.id)
  );

  let added = 0;
  let removed = 0;
  for (const { thread } of scored) {
    const current = thread.applied_tags || [];
    const has = current.includes(trendingId);
    const should = topIds.has(thread.id);

    if (should && !has) {
      const next = [...current, trendingId];
      if (next.length <= 5) {
        await patchTags(thread.id, next);
        added++;
      } // 5 etiket doluysa dokunma
    } else if (!should && has) {
      await patchTags(thread.id, current.filter((id) => id !== trendingId));
      removed++;
    }
  }
  console.log(`🔥 Trending güncellendi — eklenen: ${added}, kaldırılan: ${removed}, aday: ${topIds.size}.`);
}
