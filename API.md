# Callback API Sözleşmesi (dış arşiv sistemi için)

Dış sistem, arşive **yeni içerik eklediğinde** (veya güncellediğinde) aşağıdaki adrese
bir HTTP **POST** isteği atar. Bot bu içeriği Discord forum kanalına gönderir.

```
POST  https://discord-archive-bot.onrender.com/callback
Content-Type: application/json
```

> Not: Kendi VPS'ine taşınınca adres değişir; sadece alan adı/host değişir, gövde aynı kalır.

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
  "title": "Inception",
  "description": "Rüya içinde rüya: bilinçaltına fikir yerleştirme operasyonu.",
  "image": "https://cdn.ornek.com/posters/inception-yatay.jpg",
  "url": "https://ornek.com/izle/inception",
  "category": "film",
  "year": 2010,
  "quality": "1080p",
  "tags": ["New Release", "US", "Dubbed"],
  "region": "US",
  "audio": "dubbed",
  "isNew": true,
  "id": "tt1375666",
  "event": "added"
}
```

---

## Alanlar

| Alan          | Tip            | Zorunlu | Açıklama |
|---------------|----------------|:------:|----------|
| `title`       | string         | ✅ | İçerik adı. Forum **post başlığı** olur. |
| `image`       | string (URL)   | ⭐ önerilen | **Kapak görseli** (yatay/landscape tercih edilir). Büyük gösterilir. |
| `category`    | string         | ⭐ önerilen | `film` \| `dizi` \| `anime` \| `adult`. Renk + emoji + kategori etiketini belirler. Boşsa metinden otomatik tahmin edilir. |
| `description` | string         | – | Kısa özet. Embed içinde gösterilir. |
| `url`         | string (URL)   | – | İçerik/izleme linki. Başlık tıklanabilir olur. |
| `year`        | number/string  | – | Yapım yılı. |
| `quality`     | string         | – | `1080p`, `4K`, `720p` vb. |
| `tags`        | string[]       | – | Doğrudan **forum etiket adları** (aşağıdaki listeden). Bot eşleşenleri uygular. |
| `region`      | string         | – | `global` \| `asia` \| `eu` \| `us` → ilgili bölge etiketine çevrilir. |
| `audio`       | string         | – | `dubbed` \| `subbed` \| `multi` → Dubbed / Subbed / Multi Audio etiketine çevrilir. |
| `isNew`       | boolean        | – | `true` ise **New Release** etiketi eklenir. (`event: "added"` de aynı etkiyi yapar.) |
| `id`          | string         | – | Dış sistemdeki **benzersiz kimlik**. Tekrarları/güncellemeleri ayırmak için. |
| `event`       | string         | – | `added` (varsayılan) \| `updated`. |

> Alan adları esnektir: Türkçe/İngilizce karşılıklar da tanınır (`baslik`, `ad`, `aciklama`,
> `poster`, `gorsel`, `tur`, `kategori`, `link`, `yil`, `kalite` …) ve iç içe nesnelerde
> (`data.name`, `image.url`) aranır. Yine de **yukarıdaki standart adları** kullanmaları en sağlamı.

---

## Forum etiketleri (kanaldaki mevcut etiketler)

`tags` dizisine bu adlardan istediklerini koyabilirler (büyük/küçük harf önemsiz):

```
New Release · Trending · Featured · Classic · Global · Asia · EU · US · Multi Audio · Dubbed · Subbed
```

**Etiket kuralları:**
- **New Release** → yeni eklenenlere otomatik (veya `isNew: true`). "New Release" etiketine tıklayan herkes yeni içerikleri görür.
- **Trending** → bizim botumuz **otomatik** yönetir (en çok beğeni alan postlara eklenir); dış sistemin göndermesine gerek yok.
- **Global / Asia / EU / US** → `region` alanından ya da `tags` ile.
- **Multi Audio / Dubbed / Subbed** → `audio` alanından ya da `tags` ile.
- **Featured / Classic** → sadece `tags` ile (isterlerse).

---

## Yanıtlar

| Durum | HTTP | Gövde |
|-------|------|-------|
| Başarılı | `200` | `{"ok":true,"title":"Inception","category":"Film"}` |
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
curl -X POST https://discord-archive-bot.onrender.com/callback \
  -H "Content-Type: application/json" \
  -d '{"title":"Inception","category":"film","year":2010,"quality":"1080p","image":"https://.../inception.jpg","url":"https://.../izle","tags":["New Release","US","Dubbed"]}'
```

**Node.js:**
```js
await fetch("https://discord-archive-bot.onrender.com/callback", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    title: "Inception",
    category: "film",
    year: 2010,
    image: "https://.../inception.jpg",
    url: "https://.../izle",
    tags: ["New Release", "US", "Dubbed"],
  }),
});
```

**PHP:**
```php
$ch = curl_init("https://discord-archive-bot.onrender.com/callback");
curl_setopt_array($ch, [
  CURLOPT_POST => true,
  CURLOPT_HTTPHEADER => ["Content-Type: application/json"],
  CURLOPT_POSTFIELDS => json_encode([
    "title" => "Inception",
    "category" => "film",
    "image" => "https://.../inception.jpg",
    "tags" => ["New Release", "US"],
  ]),
  CURLOPT_RETURNTRANSFER => true,
]);
curl_exec($ch);
```
