// Gelen payload'un yapısını önceden bilmiyoruz. Bu modül, dış arşiv sisteminin
// gönderdiği JSON ne şekilde olursa olsun, içerikle ilgili alanları (başlık, tür,
// görsel, link, açıklama, kategori) Türkçe + İngilizce anahtar adlarına bakarak
// akıllıca yakalamaya çalışır.

// Bir nesnenin içinde, verilen aday anahtarlardan ilk dolu olanı (iç içe nesnelerde
// de arayarak) bulur. Anahtar adlarını büyük/küçük harf ve "_-." farkı gözetmeden eşler.
function findValue(obj, candidates, { maxDepth = 4 } = {}) {
  const wanted = candidates.map(normalizeKey);
  const seen = new Set();

  function walk(node, depth) {
    if (!node || typeof node !== "object" || depth > maxDepth || seen.has(node)) {
      return undefined;
    }
    seen.add(node);

    // Önce bu seviyedeki anahtarlara doğrudan bak.
    for (const [key, value] of Object.entries(node)) {
      if (wanted.includes(normalizeKey(key)) && isUsable(value)) {
        return value;
      }
    }
    // Bulamazsak iç içe nesnelere in.
    for (const value of Object.values(node)) {
      if (value && typeof value === "object") {
        const found = walk(value, depth + 1);
        if (found !== undefined) return found;
      }
    }
    return undefined;
  }

  return walk(obj, 0);
}

function normalizeKey(key) {
  return String(key).toLowerCase().replace(/[\s_\-.]/g, "");
}

function isUsable(value) {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (typeof value === "number" || typeof value === "boolean") return true;
  return false;
}

// Verilen anahtarlarla eşleşen TÜM değerleri (iç içe nesnelerde de) toplayıp
// tek bir metin olarak döndürür. Kategori tahmini için birden çok ipucu gerekir
// (ör. hem "tur": "Bilim Kurgu" hem "kategori": "Film" aynı anda değerlendirilir).
function collectValues(obj, candidates, { maxDepth = 4 } = {}) {
  const wanted = candidates.map(normalizeKey);
  const found = [];
  const seen = new Set();

  function walk(node, depth) {
    if (!node || typeof node !== "object" || depth > maxDepth || seen.has(node)) return;
    seen.add(node);
    for (const [key, value] of Object.entries(node)) {
      if (wanted.includes(normalizeKey(key))) {
        const text = asText(value);
        if (text) found.push(text);
      }
      if (value && typeof value === "object") walk(value, depth + 1);
    }
  }

  walk(obj, 0);
  return found.join(" ");
}

// Bir değeri okunabilir metne çevirir (dizi/nesne ise düzleştirir).
function asText(value) {
  if (value === null || value === undefined) return undefined;
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) {
    return value.map(asText).filter(Boolean).join(", ");
  }
  return undefined;
}

// İçeriğin kategorisini (dizi/film/anime/adult) metinden tahmin eder.
function detectCategory(...texts) {
  const haystack = texts.filter(Boolean).join(" ").toLowerCase();
  const rules = [
    { key: "anime", words: ["anime", "anim", "manga"], label: "Anime", emoji: "🌸", color: 0xff6fb5 },
    { key: "adult", words: ["adult", "yetişkin", "yetiskin", "18+", "xxx", "porn", "erotik"], label: "Adult (18+)", emoji: "🔞", color: 0xc0392b },
    { key: "dizi", words: ["dizi", "series", "tv", "show", "season", "sezon", "episode", "bölüm", "bolum"], label: "Dizi", emoji: "📺", color: 0x5865f2 },
    { key: "film", words: ["film", "movie", "sinema", "cinema"], label: "Film", emoji: "🎬", color: 0xf1c40f },
  ];
  for (const rule of rules) {
    if (rule.words.some((w) => haystack.includes(w))) return rule;
  }
  return { key: "icerik", words: [], label: "Yeni İçerik", emoji: "✨", color: 0x2ecc71 };
}

// Ana fonksiyon: ham payload -> normalize edilmiş içerik nesnesi.
export function extractContent(payload) {
  const title =
    asText(findValue(payload, ["title", "name", "baslik", "başlık", "isim", "ad", "moviename", "seriesname", "originaltitle"]));

  const description =
    asText(findValue(payload, ["description", "aciklama", "açıklama", "overview", "summary", "plot", "ozet", "özet", "synopsis"]));

  const image =
    asText(findValue(payload, ["image", "poster", "cover", "gorsel", "görsel", "thumbnail", "thumb", "posterurl", "imageurl", "backdrop", "img"]));

  const url =
    asText(findValue(payload, ["url", "link", "watchurl", "page", "detailurl", "permalink", "href", "izle", "watch"]));

  const rawType =
    asText(findValue(payload, ["type", "tur", "tür", "category", "kategori", "genre", "genres", "contenttype", "mediatype"]));

  const year =
    asText(findValue(payload, ["year", "yil", "yıl", "releaseyear", "releasedate", "date", "tarih"]));

  const quality =
    asText(findValue(payload, ["quality", "kalite", "resolution", "cozunurluk", "çözünürlük"]));

  // Kategori tahmini: sadece ilk eşleşen "tür" değil, tüm kategori-benzeri alanları
  // (tip/tür/kategori/genre vb.) + başlık + açıklamayı birlikte değerlendir.
  const categoryHints = collectValues(payload, [
    "type", "tur", "tür", "category", "kategori", "genre", "genres", "contenttype", "mediatype", "tags", "etiket", "etiketler",
  ]);
  const category = detectCategory(categoryHints, title, description);

  return { title, description, image, url, rawType, year, quality, category };
}
