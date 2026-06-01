import "dotenv/config";
import express from "express";
import { extractContent, deriveTags } from "./extractor.js";
import { sendToDiscord } from "./discord.js";
import { initBot, tagIdsFor } from "./discordBot.js";
import { resolveRoute, routeSummary } from "./config.js";

const PORT = Number(process.env.PORT) || 3000;
const CALLBACK_SECRET = process.env.CALLBACK_SECRET?.trim();

const app = express();

// Gelen veriyi hem JSON hem de form-urlencoded olarak kabul et.
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

// Basit istek logu.
app.use((req, _res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// Sağlık kontrolü — tarayıcıdan açıp ayakta mı diye bakabilirsin.
app.get("/", (_req, res) => {
  res.json({ status: "ok", message: "Arşiv botu çalışıyor. Bildirimler POST /callback adresine gönderilir." });
});

// Ana callback endpoint'i. Dış arşiv sistemi yeni içerik eklediğinde buraya POST atar.
// /callback ve /webhook adreslerinin ikisi de çalışır.
app.post(["/callback", "/webhook"], async (req, res) => {
  // Güvenlik şimdilik kapalı. CALLBACK_SECRET .env'de doldurulursa otomatik devreye girer.
  if (CALLBACK_SECRET) {
    const provided =
      req.get("x-callback-secret") ||
      req.query.secret ||
      req.body?.secret;
    if (provided !== CALLBACK_SECRET) {
      console.warn("Reddedildi: geçersiz veya eksik secret.");
      return res.status(401).json({ ok: false, error: "unauthorized" });
    }
  }

  const payload = req.body;

  if (!payload || (typeof payload === "object" && Object.keys(payload).length === 0)) {
    return res.status(400).json({ ok: false, error: "Boş istek gövdesi." });
  }

  try {
    const content = extractContent(payload);

    // type (ya da algılanan kategori) -> hangi kanala gideceğini belirle.
    const route = resolveRoute(content.type, content.category.key);
    if (!route) {
      const msg = `'${content.type || content.category.label}' türü için tanımlı kanal/webhook yok.`;
      console.error("❌ Yönlendirme hatası:", msg);
      return res.status(400).json({ ok: false, error: msg });
    }

    const tagNames = deriveTags(payload);
    const tagIds = tagIdsFor(route.channelId, tagNames); // bot kapalıysa boş döner
    await sendToDiscord(route, content, payload, tagIds);

    console.log(
      `✅ [${route.label}] gönderildi: ${content.title || "(başlık tanınamadı)"} [${content.category.label}]` +
        (tagNames.length ? ` · etiketler: ${tagNames.join(", ")}` : "")
    );
    // Dış sisteme hızlı yanıt dön.
    return res.json({
      ok: true,
      title: content.title ?? null,
      type: content.type ?? null,
      channel: route.label,
      category: content.category.label,
      tags: tagNames,
    });
  } catch (err) {
    console.error("❌ Gönderim hatası:", err.message);
    return res.status(502).json({ ok: false, error: err.message });
  }
});

// Beklenmeyen hataların sunucuyu düşürmesini engelle (7/24 çalışsın).
process.on("unhandledRejection", (err) => console.error("unhandledRejection:", err));
process.on("uncaughtException", (err) => console.error("uncaughtException:", err));

app.listen(PORT, () => {
  console.log("────────────────────────────────────────────");
  console.log(`🤖 Drakkar Archive botu ayakta — port ${PORT}`);
  console.log(`📥 Callback URL:  http://localhost:${PORT}/callback`);
  console.log(`💚 Sağlık:        http://localhost:${PORT}/`);
  console.log(`🔐 Güvenlik:      ${CALLBACK_SECRET ? "AÇIK (secret gerekli)" : "KAPALI (test modu)"}`);
  console.log("📡 Kanal yönlendirme:");
  console.log(routeSummary());
  console.log("────────────────────────────────────────────");
  // Bot Token varsa tüm kanalların etiketlerini yükle + Trending döngülerini başlat.
  initBot();
});
