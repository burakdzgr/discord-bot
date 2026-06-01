// Discord webhook'una mesaj gönderme katmanı.
// Node 18+ yerleşik global fetch kullanılır (ekstra paket gerekmez).

const WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;
const USERNAME = process.env.BOT_USERNAME?.trim() || undefined;
const AVATAR_URL = process.env.BOT_AVATAR_URL?.trim() || undefined;

// Normalize edilmiş içerikten şık bir Discord embed'i kurar.
function buildEmbed(content) {
  const { title, description, image, url, rawType, year, quality, category } = content;

  const fields = [];
  if (rawType) fields.push({ name: "Tür", value: trunc(rawType, 256), inline: true });
  if (year) fields.push({ name: "Yıl", value: trunc(year, 256), inline: true });
  if (quality) fields.push({ name: "Kalite", value: trunc(quality, 256), inline: true });

  const embed = {
    title: trunc(`${category.emoji} ${title || "İsimsiz içerik"}`, 256),
    color: category.color,
    timestamp: new Date().toISOString(),
    footer: { text: `Arşive eklendi · ${category.label}` },
  };

  if (description) embed.description = trunc(description, 4000);
  if (url && /^https?:\/\//i.test(url)) embed.url = url;
  if (image && /^https?:\/\//i.test(image)) embed.image = { url: image };
  if (fields.length) embed.fields = fields;

  return embed;
}

function trunc(str, max) {
  const s = String(str);
  return s.length > max ? s.slice(0, max - 1) + "…" : s;
}

// İçeriği Discord'a gönderir. Hata olursa fırlatır (çağıran tarafta loglanır).
export async function sendToDiscord(content, rawPayload) {
  if (!WEBHOOK_URL) {
    throw new Error("DISCORD_WEBHOOK_URL tanımlı değil (.env dosyasını kontrol et).");
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

  // İlk deneme: normal metin kanalı varsayımıyla gönder.
  let res = await post(body);

  // Webhook bir FORUM/MEDIA kanalına bağlıysa Discord thread_name ister (kod 220001).
  // Bu durumda her içerik için bir forum gönderisi başlığı ekleyip tekrar deneriz.
  if (res.status === 400) {
    const errText = await res.clone().text().catch(() => "");
    if (errText.includes("220001")) {
      // Forum post başlığı: sade, sadece içerik adı (emoji yok). Kategori emojisi embed içinde kalır.
      const threadName = trunc(content.title || content.category.label, 100);
      res = await post({ ...body, thread_name: threadName });
    }
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Discord webhook hatası: ${res.status} ${res.statusText} ${text}`);
  }
}

// Webhook'a tek bir POST isteği atar.
function post(body) {
  return fetch(WEBHOOK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}
