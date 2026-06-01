import "dotenv/config";
import express from "express";
import { extractContent, deriveTags } from "./extractor.js";
import { sendToDiscord } from "./discord.js";
import { initBot, tagIdsFor } from "./discordBot.js";

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
    const tagNames = deriveTags(payload);
    const tagIds = tagIdsFor(tagNames); // bot kapalıysa boş döner
    await sendToDiscord(content, payload, tagIds);
    console.log(
      `✅ Discord'a gönderildi: ${content.title || "(başlık tanınamadı)"} [${content.category.label}]` +
        (tagNames.length ? ` · etiketler: ${tagNames.join(", ")}` : "")
    );
    // Dış sisteme hızlı yanıt dön.
    return res.json({ ok: true, title: content.title ?? null, category: content.category.label, tags: tagNames });
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
  console.log("────────────────────────────────────────────");
  // Bot Token varsa etiketleri yükle + Trending döngüsünü başlat (yoksa sessizce atlar).
  initBot();
});
