// Dış arşiv sistemini taklit eden test scripti.
// Botu çalıştırdıktan sonra başka bir terminalde: npm run test:send
// Kasıtlı olarak farklı/iç içe alan adları kullanır — esnek ayrıştırmayı test eder.

const URL = process.env.CALLBACK_URL || "http://localhost:3000/callback";

const samples = [
  {
    baslik: "Breaking Bad",
    aciklama: "Bir kimya öğretmeninin metamfetamin imparatorluğuna dönüşen hikayesi.",
    tur: "Dizi",
    yil: 2008,
    poster: "https://image.tmdb.org/t/p/w500/ggFHVNu6YYI5L9pCfOacjizRGt.jpg",
    link: "https://example.com/breaking-bad",
  },
  {
    data: {
      name: "Spirited Away",
      overview: "Chihiro adlı kız, ruhların dünyasında mahsur kalır.",
      genre: "Anime",
      year: 2001,
      image: { url: "https://image.tmdb.org/t/p/w500/39wmItIWsg5sZMyRUHLkWBcuVCM.jpg" },
    },
    watchUrl: "https://example.com/spirited-away",
  },
  {
    title: "Inception",
    category: "Film",
    quality: "1080p",
    description: "Rüya içinde rüya: bilinçaltına fikir yerleştirme operasyonu.",
  },
];

async function run() {
  for (const [i, body] of samples.entries()) {
    try {
      const res = await fetch(URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => ({}));
      console.log(`#${i + 1} -> ${res.status}`, json);
    } catch (err) {
      console.error(`#${i + 1} hata:`, err.message);
    }
  }
}

run();
