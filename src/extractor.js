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

// findValue gibi ama isUsable filtresi YOK: eşleşen ilk anahtarın ham değerini
// (dizi/nesne dahil) döndürür. Etiket dizileri (tags: [...]) için gerekli.
function findRawValue(obj, candidates, { maxDepth = 4 } = {}) {
  const wanted = candidates.map(normalizeKey);
  const seen = new Set();

  function walk(node, depth) {
    if (!node || typeof node !== "object" || depth > maxDepth || seen.has(node)) return undefined;
    seen.add(node);
    for (const [key, value] of Object.entries(node)) {
      if (wanted.includes(normalizeKey(key)) && value !== null && value !== undefined) return value;
    }
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

  // type: hangi kanala yönlendirileceğini belirleyen ana alan (Movie/Series/Anime/Adult).
  const type =
    asText(findValue(payload, ["type", "tip", "contenttype", "mediatype"]));

  // Ses / altyazı / süre — embed detayında gösterilir.
  const audio =
    asText(findValue(payload, ["audio", "ses", "audiolanguages", "audiolanguage", "dublaj", "seslendirme"]));

  const subtitles =
    asText(findValue(payload, ["subtitles", "subtitle", "altyazi", "altyazı", "subtitlelanguages", "subs"]));

  const duration =
    asText(findValue(payload, ["duration", "sure", "süre", "runtime", "length"]));

  // Kategori tahmini: sadece ilk eşleşen "tür" değil, tüm kategori-benzeri alanları
  // (tip/tür/kategori/genre vb.) + başlık + açıklamayı birlikte değerlendir.
  const categoryHints = collectValues(payload, [
    "type", "tur", "tür", "category", "kategori", "genre", "genres", "contenttype", "mediatype", "tags", "etiket", "etiketler",
  ]);
  const category = detectCategory(categoryHints, title, description);

  return { title, description, image, url, rawType, year, quality, type, audio, subtitles, duration, category };
}

// Payload'dan uygulanacak FORUM ETİKETİ adlarını türetir.
// (discordBot.js bunları kanaldaki gerçek etiket ID'lerine çevirir; eşleşmeyenler yok sayılır.)
// "Trending" buradan gelmez — onu bot beğenilere göre otomatik yönetir.
export function deriveTags(payload) {
  const names = new Set();

  // 1) Doğrudan gönderilen etiket adları (dizi veya virgüllü metin).
  const explicit = findRawValue(payload, ["tags", "etiketler", "etiket", "labels"]);
  if (Array.isArray(explicit)) {
    explicit.forEach((t) => {
      const s = asText(t);
      if (s) names.add(s);
    });
  } else if (typeof explicit === "string") {
    explicit.split(/[,;|]/).forEach((t) => {
      const s = t.trim();
      if (s) names.add(s);
    });
  }

  // 2) New Release: güncelleme değilse (yeni içerikse) otomatik eklenir.
  const event = asText(findValue(payload, ["event", "action", "durum"]))?.toLowerCase();
  const isNewRaw = findValue(payload, ["isnew", "yeni", "new"]);
  const isUpdate =
    event === "updated" || event === "update" || event === "guncelleme" ||
    isNewRaw === false || isNewRaw === "false";
  if (!isUpdate) names.add("New Release");

  // 3) Bölge -> etiket.
  const region = asText(findValue(payload, ["region", "bolge", "bölge", "ulke", "ülke", "country"]))?.toLowerCase();
  const regionMap = {
    global: "Global", world: "Global", dunya: "Global",
    asia: "Asia", asya: "Asia",
    eu: "EU", europe: "EU", avrupa: "EU",
    us: "US", usa: "US", abd: "US", america: "US", amerika: "US",
  };
  if (region && regionMap[region]) names.add(regionMap[region]);

  // 4) Ses -> etiket (Multi Audio / Dubbed / Subbed).
  const audio = asText(findValue(payload, ["audio", "ses", "dub", "dublaj", "altyazi", "altyazı", "subtitle"]))?.toLowerCase();
  if (audio) {
    if (/multi|çoklu|coklu/.test(audio)) names.add("Multi Audio");
    else if (/dub|dublaj|seslendir/.test(audio)) names.add("Dubbed");
    else if (/sub|altyaz/.test(audio)) names.add("Subbed");
  }

  return [...names];
}
