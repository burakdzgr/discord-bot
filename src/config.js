// Tür (type) -> kanal yönlendirme tablosu.
// Gelen payload'daki "type" alanına göre içerik ilgili kanalın webhook'una gönderilir.
// Her tür için env'den iki değer okunur:  <TÜR>_WEBHOOK_URL  ve  <TÜR>_CHANNEL_ID
//   örn. MOVIE_WEBHOOK_URL / MOVIE_CHANNEL_ID, ADULT_WEBHOOK_URL / ADULT_CHANNEL_ID
// CHANNEL_ID sadece etiket/Trending (Bot Token) için gerekir; webhook tek başına yeterli.

const TYPE_DEFS = [
  { key: "movie", label: "Film", emoji: "🎬", aliases: ["movie", "film", "sinema", "cinema", "movies"] },
  { key: "series", label: "Dizi", emoji: "📺", aliases: ["series", "dizi", "tv", "show", "tvshow", "tvseries"] },
  { key: "anime", label: "Anime", emoji: "🌸", aliases: ["anime", "manga", "animation", "anim"] },
  { key: "adult", label: "Adult", emoji: "🔞", aliases: ["adult", "18+", "xxx", "yetiskin", "yetişkin", "porn", "erotik", "nsfw"] },
];

function env(name) {
  return process.env[name]?.trim() || "";
}

function norm(s) {
  return String(s || "").toLowerCase().replace(/[\s_\-.]/g, "");
}

// Bir tür metnini (veya kategori anahtarını) bilinen bir tür anahtarına çevirir.
export function typeKeyOf(value) {
  const n = norm(value);
  if (!n) return null;
  for (const def of TYPE_DEFS) {
    if (def.key === n || def.aliases.some((a) => norm(a) === n)) return def.key;
  }
  return null;
}

// Env'den tür -> rota tablosunu kurar.
function buildRoutes() {
  const routes = {};
  for (const def of TYPE_DEFS) {
    const up = def.key.toUpperCase();
    const webhookUrl = env(`${up}_WEBHOOK_URL`);
    const channelId = env(`${up}_CHANNEL_ID`);
    if (webhookUrl) routes[def.key] = { ...def, webhookUrl, channelId };
  }
  return routes;
}

const ROUTES = buildRoutes();

// Geriye dönük uyumluluk: eski tek webhook varsa "varsayılan" rota olur
// (tür eşleşmezse veya o tür için ayrı kanal tanımlı değilse buraya düşer).
const DEFAULT_ROUTE = env("DISCORD_WEBHOOK_URL")
  ? {
      key: "default",
      label: "İçerik",
      emoji: "✨",
      webhookUrl: env("DISCORD_WEBHOOK_URL"),
      channelId: env("FORUM_CHANNEL_ID"),
    }
  : null;

// type (öncelik) ya da algılanan kategori anahtarından uygun rotayı çözer.
// Eşleşme yoksa varsayılan rotaya düşer (o da yoksa null).
export function resolveRoute(typeValue, categoryKey) {
  const key = typeKeyOf(typeValue) || typeKeyOf(categoryKey);
  if (key && ROUTES[key]) return ROUTES[key];
  return DEFAULT_ROUTE;
}

// Bot'un etiket yüklemesi/Trending için izleyeceği tüm benzersiz kanal ID'leri.
export function allChannelIds() {
  const ids = new Set();
  for (const r of Object.values(ROUTES)) if (r.channelId) ids.add(r.channelId);
  if (DEFAULT_ROUTE?.channelId) ids.add(DEFAULT_ROUTE.channelId);
  return [...ids];
}

// Başlangıç logu için okunabilir özet.
export function routeSummary() {
  const lines = [];
  for (const def of TYPE_DEFS) {
    const r = ROUTES[def.key];
    lines.push(`   ${def.emoji} ${def.label.padEnd(6)} → ${r ? (r.channelId ? "webhook + kanal ✓" : "webhook ✓ (etiketsiz)") : "tanımsız → varsayılan"}`);
  }
  lines.push(`   ✨ Varsayılan → ${DEFAULT_ROUTE ? (DEFAULT_ROUTE.channelId ? "webhook + kanal ✓" : "webhook ✓") : "YOK ⚠️"}`);
  return lines.join("\n");
}

export { TYPE_DEFS };
