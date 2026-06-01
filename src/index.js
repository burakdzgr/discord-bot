import "dotenv/config";
import express from "express";
import { routeSummary } from "./config.js";
import { processContent } from "./process.js";
import { startFetcher, fetcherEnabled, postLatest } from "./jpvFetcher.js";

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
    const { content, route, tagNames } = await processContent(payload);
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

// Manuel test tetikleyici: JPV'den en son N içeriği çekip gönderir.
//   GET /fetch-latest?type=movie&target=Movie&count=1
// (CALLBACK_SECRET açıksa ?secret=... gerekir.)
app.get("/fetch-latest", async (req, res) => {
  if (CALLBACK_SECRET && req.query.secret !== CALLBACK_SECRET) {
    return res.status(401).json({ ok: false, error: "unauthorized" });
  }
  if (!fetcherEnabled()) {
    return res.status(400).json({ ok: false, error: "JPV fetcher kapalı (JPV_EMAIL/JPV_PASSWORD yok)." });
  }
  try {
    const count = Math.min(Number(req.query.count) || 1, 10);
    const sent = await postLatest(count);
    return res.json({ ok: true, sent });
  } catch (err) {
    console.error("❌ fetch-latest hatası:", err.message);
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
  console.log(`📡 JPV fetcher:    ${fetcherEnabled() ? "AÇIK" : "KAPALI (JPV_EMAIL/JPV_PASSWORD yok)"}`);
  console.log("────────────────────────────────────────────");
  // JPV kimlik bilgileri varsa periyodik çekmeyi başlat.
  startFetcher();
});
