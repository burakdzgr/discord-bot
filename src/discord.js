// Discord webhook'una mesaj gönderme katmanı.
// Node 18+ yerleşik global fetch kullanılır (ekstra paket gerekmez).

const USERNAME = process.env.BOT_USERNAME?.trim() || undefined;
const AVATAR_URL = process.env.BOT_AVATAR_URL?.trim() || undefined;

// Normalize edilmiş içerikten "sinematik / sade" bir Discord embed'i kurar:
// üstte küçük kategori etiketi, büyük başlık, kısa açıklama, büyük kapak görseli.
function buildEmbed(content) {
  const { title, description, image, url, rawType, year, category } = content;

  // Üst etiket satırı (author): "🎬 Film · Bilim Kurgu · 2010"
  const tags = [`${category.emoji} ${category.label}`];
  if (rawType && !sameWord(rawType, category.label) && !sameWord(rawType, category.key)) {
    tags.push(rawType);
  }
  if (year) tags.push(year);

  const embed = {
    author: { name: trunc(tags.join(" · "), 256) },
    title: trunc(title || "Untitled", 256),
    color: category.color,
    timestamp: new Date().toISOString(),
    footer: { text: "Added to archive" },
  };

  if (description) embed.description = trunc(description, 4000);
  if (url && /^https?:\/\//i.test(url)) embed.url = url;          // başlık tıklanabilir olur

  // Detay alanları: quality / audio / subtitle / duration (yalnızca dolu olanlar, yan yana).
  const fields = [];
  if (content.quality) fields.push({ name: "🎞️ Quality", value: trunc(content.quality, 256), inline: true });
  if (content.audio) fields.push({ name: "🔊 Audio", value: trunc(content.audio, 256), inline: true });
  if (content.subtitles) fields.push({ name: "💬 Subtitle", value: trunc(content.subtitles, 256), inline: true });
  if (content.duration) fields.push({ name: "⏱️ Duration", value: trunc(content.duration, 256), inline: true });
  if (fields.length) embed.fields = fields;

  if (image && /^https?:\/\//i.test(image)) embed.image = { url: image };

  return embed;
}

// İki metnin (büyük/küçük harf, boşluk farkı gözetmeden) aynı kelime olup olmadığı.
function sameWord(a, b) {
  return String(a).toLowerCase().replace(/\s+/g, "") === String(b).toLowerCase().replace(/\s+/g, "");
}

function trunc(str, max) {
  const s = String(str);
  return s.length > max ? s.slice(0, max - 1) + "…" : s;
}

// İçeriği, çözülen ROTANIN webhook'una gönderir.
//   route: { webhookUrl, channelId, ... }  (config.js -> resolveRoute)
// Hata olursa fırlatır (çağıran tarafta loglanır).
export async function sendToDiscord(route, content, rawPayload) {
  if (!route || !route.webhookUrl) {
    throw new Error("Bu içerik için bir webhook/rota tanımlı değil (type eşleşmedi ve varsayılan yok).");
  }

  const embed = buildEmbed(content);

  const body = {
    username: USERNAME,
    avatar_url: AVATAR_URL,
    embeds: [embed],
  };

  // Hiç anlamlı alan çıkaramadıysak, ham veriyi de ekleyelim ki bilgi kaybolmasın.
  if (!content.title && !content.description && rawPayload) {
    const raw = trunc(JSON.stringify(rawPayload, null, 2), 1800);
    body.content = "⚠️ İçerik alanları otomatik tanınamadı, ham veri:\n```json\n" + raw + "\n```";
  }

  // Forum post başlığı: sade, sadece içerik adı. Kategori emojisi embed içinde.
  const threadName = trunc(content.title || content.category.label, 100);
  const forumBody = { ...body, thread_name: threadName };

  // channelId tanımlıysa rotanın forum kanalı olduğunu biliyoruz -> doğrudan thread_name ile gönder.
  const forumMode = Boolean(route.channelId);

  let res;
  if (forumMode) {
    res = await post(route.webhookUrl, forumBody);
  } else {
    // Kanal tipini bilmiyoruz: önce normal dene, forum hatasında (220001) thread_name ile tekrarla.
    res = await post(route.webhookUrl, body);
    if (res.status === 400) {
      const errText = await res.clone().text().catch(() => "");
      if (errText.includes("220001")) res = await post(route.webhookUrl, forumBody);
    }
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Discord webhook hatası: ${res.status} ${res.statusText} ${text}`);
  }
}

// Belirtilen webhook'a tek bir POST isteği atar.
function post(webhookUrl, body) {
  return fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}
