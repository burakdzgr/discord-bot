// Bot Token tabanlı işlemler (webhook'un yapamadıkları), ÇOK KANALLI:
//  - Her forum kanalının etiketlerini (available_tags) okuyup ad -> ID haritası kurmak
//  - Her kanalda en çok beğeni alan postlara "Trending" etiketini periyodik uygulamak
// Tek BOT_TOKEN ile birden fazla kanal yönetilir (config.js'teki rotaların channelId'leri).
// BOT_TOKEN yoksa tüm bu özellikler sessizce devre dışı kalır (bot yalnızca webhook ile çalışır).

import { allChannelIds } from "./config.js";

const API = "https://discord.com/api/v10";
const TOKEN = process.env.BOT_TOKEN?.trim();
const TRENDING_TAG = (process.env.TRENDING_TAG_NAME || "Trending").trim();
const TRENDING_TOP_N = Number(process.env.TRENDING_TOP_N) || 10;
const TRENDING_INTERVAL_MS = (Number(process.env.TRENDING_INTERVAL_MIN) || 30) * 60 * 1000;

// channelId -> { guildId, tagMap: Map(normAd -> id), trendingId }
const channels = new Map();

export function botEnabled() {
  return Boolean(TOKEN);
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

// Başlangıçta tüm kanalların etiketlerini yükler + Trending döngülerini başlatır.
export async function initBot() {
  const ids = allChannelIds();
  if (!TOKEN) {
    console.log("ℹ️  Bot Token yok — etiket/Trending kapalı (yalnızca webhook çalışıyor).");
    return;
  }
  if (!ids.length) {
    console.log("ℹ️  Hiç forum kanal ID'si tanımlı değil — etiket/Trending kapalı.");
    return;
  }

  for (const channelId of ids) {
    try {
      const res = await api(`/channels/${channelId}`);
      if (!res.ok) throw new Error(`${res.status} ${await res.text().catch(() => "")}`);
      const ch = await res.json();
      const tags = ch.available_tags || [];
      const tagMap = new Map(tags.map((t) => [normalize(t.name), t.id]));
      const trendingId = tagMap.get(normalize(TRENDING_TAG)) || null;
      channels.set(channelId, { guildId: ch.guild_id, tagMap, trendingId });

      console.log(`🏷️  [${ch.name || channelId}] etiketler (${tagMap.size}): ${tags.map((t) => t.name).join(", ") || "(yok)"}`);
      if (trendingId) {
        startTrendingLoop(channelId, ch.name || channelId);
      } else {
        console.log(`   ℹ️  "${TRENDING_TAG}" etiketi yok — bu kanalda Trending kapalı.`);
      }
    } catch (err) {
      console.error(`❌ Kanal yüklenemedi (${channelId}): ${err.message}`);
    }
  }
}

// Belirli bir kanal için etiket adlarını ID listesine çevirir (forum sınırı: max 5).
export function tagIdsFor(channelId, names) {
  const ch = channelId && channels.get(channelId);
  if (!ch || !Array.isArray(names)) return [];
  const ids = [];
  for (const name of names) {
    const id = ch.tagMap.get(normalize(name));
    if (id && !ids.includes(id)) ids.push(id);
  }
  return ids.slice(0, 5);
}

// ───────────────────────── Trending otomasyonu (kanal başına) ─────────────────────────

function startTrendingLoop(channelId, name) {
  const dk = Math.round(TRENDING_INTERVAL_MS / 60000);
  console.log(`🔥 [${name}] Trending açık: her ${dk} dk, en çok beğeni alan ilk ${TRENDING_TOP_N} post.`);
  setTimeout(() => runTrending(channelId, name), 15000); // ilk turu biraz geciktir
  setInterval(() => runTrending(channelId, name), TRENDING_INTERVAL_MS);
}

function runTrending(channelId, name) {
  updateTrending(channelId, name).catch((e) => console.error(`🔥 [${name}] Trending hatası:`, e.message));
}

// Bir forum kanalındaki post'ları (aktif + son arşivlenenler) toplar.
async function listForumThreads(channelId, guildId) {
  const threads = new Map(); // id -> thread

  try {
    const r = await api(`/guilds/${guildId}/threads/active`);
    if (r.ok) {
      const d = await r.json();
      for (const t of d.threads || []) if (t.parent_id === channelId) threads.set(t.id, t);
    }
  } catch (e) {
    console.error("aktif thread listesi:", e.message);
  }

  try {
    const r = await api(`/channels/${channelId}/threads/archived/public?limit=100`);
    if (r.ok) {
      const d = await r.json();
      for (const t of d.threads || []) threads.set(t.id, t);
    }
  } catch (e) {
    console.error("arşiv thread listesi:", e.message);
  }

  return [...threads.values()];
}

// Forum postunun ilk mesajındaki toplam tepki (beğeni) sayısı.
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

async function updateTrending(channelId, name) {
  const ch = channels.get(channelId);
  if (!ch || !ch.trendingId) return;
  const trendingId = ch.trendingId;

  const threads = await listForumThreads(channelId, ch.guildId);
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
  console.log(`🔥 [${name}] Trending — eklenen: ${added}, kaldırılan: ${removed}, aday: ${topIds.size}.`);
}
