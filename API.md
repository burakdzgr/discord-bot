# Callback API Sözleşmesi (opsiyonel)

> Botun **asıl veri kaynağı** JPV video API'sidir (otomatik çekme — bkz. [VPS.md](VPS.md)).
> Bu callback, İSTERSEN başka bir dış sistemin de içerik göndermesi için duruyor; zorunlu değil.

Dış sistem, arşive **yeni içerik eklediğinde** aşağıdaki adrese bir HTTP **POST** atar.
Bot bu içeriği ilgili Discord forum kanalına gönderir.

```
POST  https://SENIN-VPS-ADRESIN/callback        (VPS alan adın / IP'n)
Content-Type: application/json
```

---

## En sade geçerli istek

Sadece `title` zorunludur. Görsel şiddetle önerilir (kapak için).

```json
{
  "title": "Inception",
  "image": "https://cdn.ornek.com/posters/inception.jpg"
}
```

## Tam örnek (tüm alanlar)

```json
{
  "type": "Movie",
  "title": "Inception",
  "description": "Rüya içinde rüya: bilinçaltına fikir yerleştirme operasyonu.",
  "image": "https://cdn.ornek.com/posters/inception-yatay.jpg",
  "url": "https://ornek.com/izle/inception",
  "category": "film",
  "year": 2010,
  "quality": "1080p, 720p",
  "audio": "Türkçe",
  "subtitles": "İngilizce",
  "duration": "2sa 28dk",
  "id": "tmdb:27205"
}
```

> **`type` hangi kanala gideceğini belirler** (aşağıdaki "Kanal yönlendirme" bölümüne bak).

---

## Alanlar

| Alan          | Tip            | Zorunlu | Açıklama |
|---------------|----------------|:------:|----------|
| `type`        | string         | ⭐ önerilen | İçeriğin **kanalını** belirler: `Movie` \| `Series` \| `Anime` \| `Adult`. Boşsa `category`/metinden çıkarılır; yine de bulunamazsa varsayılan kanala gider. |
| `title`       | string         | ✅ | İçerik adı. Forum **post başlığı** olur. |
| `image`       | string (URL)   | ⭐ önerilen | **Kapak görseli** (yatay/landscape tercih edilir). Büyük gösterilir. |
| `category`    | string         | ⭐ önerilen | `film` \| `dizi` \| `anime` \| `adult`. Renk + emoji + kategori etiketini belirler. Boşsa metinden otomatik tahmin edilir. |
| `description` | string         | – | Kısa özet. Embed içinde gösterilir. |
| `url`         | string (URL)   | – | İçerik/izleme linki. Başlık tıklanabilir olur. |
| `year`        | number/string  | – | Yapım yılı. |
| `quality`     | string         | – | `1080p`, `4K`, `720p` vb. Embed'de gösterilir. |
| `audio`       | string         | – | Ses dil(ler)i, örn. `Türkçe`, `Orijinal`. Embed'de gösterilir. |
| `subtitles`   | string         | – | Altyazı dil(ler)i. Embed'de gösterilir. |
| `duration`    | string         | – | Süre, örn. `1sa 45dk`. Embed'de gösterilir. |
| `id`          | string         | – | Dış sistemdeki **benzersiz kimlik**. Tekrarları/güncellemeleri ayırmak için. |

> Alan adları esnektir: Türkçe/İngilizce karşılıklar da tanınır (`baslik`, `ad`, `aciklama`,
> `poster`, `gorsel`, `tur`, `kategori`, `link`, `yil`, `kalite` …) ve iç içe nesnelerde
> (`data.name`, `image.url`) aranır. Yine de **yukarıdaki standart adları** kullanmaları en sağlamı.

---

## Kanal yönlendirme (`type`)

`type` alanı içeriğin **hangi kanala** post edileceğini belirler:

| `type` değeri | Kanal | Tanınan eş anlamlılar |
|---------------|-------|------------------------|
| `Movie`  | Film kanalı   | movie, film, sinema |
| `Series` | Dizi kanalı   | series, dizi, tv, show |
| `Anime`  | Anime kanalı  | anime, manga |
| `Adult`  | Adult kanalı  | adult, 18+, xxx, yetişkin, nsfw |

- Büyük/küçük harf önemsiz (`movie` = `Movie` = `MOVIE`).
- `type` yoksa içerikten (kategori/metin) tahmin edilir.
- Tanınmayan veya kanalı tanımlı olmayan bir tür **varsayılan kanala** düşer (kaybolmaz).

---

## Yanıtlar

| Durum | HTTP | Gövde |
|-------|------|-------|
| Başarılı | `200` | `{"ok":true,"title":"Inception","type":"Movie","channel":"Film","category":"Film"}` |
| Boş/geçersiz gövde | `400` | `{"ok":false,"error":"..."}` |
| Discord'a iletilemedi | `502` | `{"ok":false,"error":"..."}` |
| (Güvenlik açıkken) yetkisiz | `401` | `{"ok":false,"error":"unauthorized"}` |

İdempotensi/yeniden deneme: Dış sistem `502` alırsa kısa bir süre sonra **tekrar deneyebilir**.

---

## Güvenlik (şu an KAPALI)

İleride güvenlik açıldığında istekte gizli bir anahtar beklenir. Üç yoldan biriyle gönderebilirler:

```
Header:  X-Callback-Secret: <anahtar>
veya     ?secret=<anahtar>   (query)
veya     gövdede "secret": "<anahtar>"
```

---

## Örnek çağrılar

**cURL:**
```bash
curl -X POST https://SENIN-VPS-ADRESIN/callback \
  -H "Content-Type: application/json" \
  -d '{"type":"Movie","title":"Inception","year":2010,"quality":"1080p","audio":"Türkçe","image":"https://.../inception.jpg","url":"https://.../izle"}'
```

**Node.js:**
```js
await fetch("https://SENIN-VPS-ADRESIN/callback", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    type: "Movie",
    title: "Inception",
    year: 2010,
    image: "https://.../inception.jpg",
    url: "https://.../izle",
    audio: "Türkçe",
  }),
});
```

**PHP:**
```php
$ch = curl_init("https://SENIN-VPS-ADRESIN/callback");
curl_setopt_array($ch, [
  CURLOPT_POST => true,
  CURLOPT_HTTPHEADER => ["Content-Type: application/json"],
  CURLOPT_POSTFIELDS => json_encode([
    "type" => "Movie",
    "title" => "Inception",
    "image" => "https://.../inception.jpg",
    "quality" => "1080p",
  ]),
  CURLOPT_RETURNTRANSFER => true,
]);
curl_exec($ch);
```
