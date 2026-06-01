# Drakkar Archive — Discord İçerik Botu

JPV video API'sinden (japierdolevid.com) yeni içerikleri (film/dizi/anime/adult) **otomatik
çeker**, türüne göre ilgili Discord forum kanalına şık bir embed olarak gönderir. 7/24 çalışır.

## Nasıl çalışır?

```
JPV API (videos)  ──bot periyodik çeker──▶  eşleştir  ──▶  type'a göre kanal  ──▶  Discord forum
   (yeni içerik)         (bu bot)                          (Movie/Series/Anime/Adult)

(Opsiyonel)  Dış sistem  ──POST /callback──▶  aynı boru hattı  ──▶  Discord
```

- **Otomatik çekme:** Bot e-posta+şifre ile API token'ı alır (401'de yeniler), ilk açılışta
  listedeki **son 10 video**yu ekler, sonra her 5 dk'da **yeni eklenenleri** atar. Görülen son
  id `data/jpv-state.json`'a kaydedilir (yeniden başlayınca tekrar atmaz).
- **Yönlendirme:** Her içerik `type`'ına göre kendi kanalına gider (`MOVIE_/SERIES_/ANIME_/ADULT_WEBHOOK_URL`);
  eşleşmezse varsayılan kanala (`DISCORD_WEBHOOK_URL`).
- **Embed:** Yatay kapak (cover), başlık, açıklama + Quality / Audio / Subtitle / Duration alanları (İngilizce).
- **Callback (opsiyonel):** `POST /callback` ile başka bir dış sistem de içerik gönderebilir — bkz. [API.md](API.md).

## Kurulum & Çalıştırma (VPS)

Kurulum, PM2 ile 7/24 çalıştırma, Nginx + HTTPS ve `.env` şablonu için: **[VPS.md](VPS.md)**

```bash
npm install
cp .env.example .env   # yoksa VPS.md'deki şablonu kullan
npm start              # veya pm2 start ecosystem.config.cjs
```

## Önemli ortam değişkenleri (`.env`)

| Değişken | Açıklama |
|----------|----------|
| `JPV_EMAIL` / `JPV_PASSWORD` | JPV API girişi — dolunca otomatik çekme başlar |
| `JPV_POLL_MIN` / `JPV_SEED_COUNT` | Yoklama aralığı (dk) / ilk turda eklenecek video sayısı |
| `MOVIE_/SERIES_/ANIME_/ADULT_WEBHOOK_URL` | Tür bazlı kanal webhook'ları |
| `*_CHANNEL_ID` | İlgili forum kanalı ID'si (post başlığı için) |
| `DISCORD_WEBHOOK_URL` | Varsayılan/yedek webhook |
| `BOT_USERNAME` / `BOT_AVATAR_URL` | Bot görünen adı / avatarı |
| `CALLBACK_SECRET` | Callback güvenliği (boşsa kapalı) |

## Manuel test

```bash
# Botun /fetch-latest ucu en son N içeriği çeker (JPV creds gerekli):
curl "http://localhost:3000/fetch-latest?count=1"
```

## Güvenlik

`CALLBACK_SECRET` doldurulursa `/callback` ve `/fetch-latest` her istekte
`X-Callback-Secret` başlığı / `?secret=` / gövdedeki `secret` alanını kontrol eder. Boşsa kapalı.
