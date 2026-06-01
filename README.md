# Arşiv → Discord Botu

Dış bir arşiv sistemi (dizi/film/anime/adult içerik ekleyen) yeni içerik eklediğinde
**callback URL'imize** istek atar; bot bu bildirimi alıp Discord kanalına **webhook** ile
şık bir mesaj olarak gönderir. Sürekli (7/24) ayakta çalışır.

## Nasıl çalışır?

```
Dış arşiv sistemi  ──POST──▶  http://localhost:3000/callback  ──▶  Discord Webhook  ──▶  Kanal
   (yeni içerik)                  (bu bot)                          (senin oluşturduğun)
```

Gelen JSON'un yapısı önceden bilinmiyor; bot başlık, tür, görsel, link, açıklama, yıl ve
kalite alanlarını Türkçe + İngilizce anahtar adlarına bakarak otomatik yakalar ve içeriğin
kategorisini (Dizi / Film / Anime / Adult) tahmin eder.

## Kurulum

```bash
npm install
```

`.env` dosyasındaki `DISCORD_WEBHOOK_URL` zaten dolu. Gerekirse `PORT`, `BOT_USERNAME` vb. düzenle.

## Çalıştırma

```bash
npm start        # normal çalıştırma
npm run dev      # dosya değişince otomatik yeniden başlar
```

Açıldığında konsolda callback URL'i ve sağlık adresi yazar.

## Test

Bot çalışırken **başka bir terminalde**:

```bash
npm run test:send
```

3 farklı örnek (dizi, anime, film) gönderir; Discord kanalında 3 mesaj görmelisin.

## Dış sisteme verilecek callback URL

Şimdilik yerelde: `http://localhost:3000/callback`

> Dış sistem internet üzerinden erişecekse (gerçek kullanım) botu bir sunucuya/buluta
> taşımalı ya da geçici test için ngrok gibi bir tünel kullanmalısın. Hazır olunca yardımcı olurum.

## Güvenlik

Şu an **kapalı** (test modu — herkes POST atabilir). Açmak için `.env` içindeki
`CALLBACK_SECRET` değerini doldurman yeterli; bot otomatik olarak her istekte
`x-callback-secret` başlığı / `?secret=` / gövdedeki `secret` alanını kontrol eder.

## Beklenen/desteklenen alan adları (örnekler)

| Alan      | Tanınan anahtarlar (kısmi) |
|-----------|----------------------------|
| Başlık    | title, name, baslik, isim, ad |
| Açıklama  | description, aciklama, overview, ozet |
| Görsel    | image, poster, cover, gorsel, thumbnail |
| Link      | url, link, watchUrl, izle |
| Tür       | type, tur, category, genre |
| Yıl       | year, yil, releaseDate |
| Kalite    | quality, kalite, resolution |

İç içe nesnelerde de arama yapılır (ör. `data.name`, `image.url`).
