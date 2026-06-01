# Bot Token Kurulumu (forum etiketleri + Trending için)

Etiketleri okumak/uygulamak ve "Trending"i beğenilere göre yönetmek için bir **Bot Token**
gerekiyor (webhook tek başına yapamıyor). ~5 dakikalık tek seferlik kurulum.

> **Gizlilik:** Bot Token bir paroladır. Asla repoya/koda yazma. Sadece Render panelinde
> (ve yerelde `.env` içinde — o `.gitignore`'da) gizli olarak tut.

---

## 1. Uygulama + Bot oluştur

1. https://discord.com/developers/applications → **New Application** → bir isim ver (örn. "Drakkar Archive") → **Create**.
2. Sol menü **Bot** → **Reset Token** → **Copy**. Bu değer senin `BOT_TOKEN`'ın. (Bir yere kaydet.)
3. **Privileged intents GEREKMİYOR** — bot sadece REST API kullanır (beğeni sayıları, etiketler). Hiçbir intent açmana gerek yok.

> İstersen **Bot → Public Bot** kapatabilirsin (sadece sen davet edebilesin).

## 2. Botu sunucuya davet et (doğru yetkilerle)

Aşağıdaki linkte **`UYGULAMA_ID`** yerine kendi Application ID'ni yaz
(Developer Portal → **General Information → Application ID**):

```
https://discord.com/oauth2/authorize?client_id=UYGULAMA_ID&scope=bot&permissions=17179935744
```

Bu izin değeri (`17179935744`) şunları kapsar:
- **View Channels** (kanalı görmek)
- **Read Message History** (beğenileri okumak)
- **Manage Threads** (postların etiketini değiştirmek — Trending için şart)

Linki aç → sunucunu seç → **Yetkilendir**. Sonra Discord'da kontrol et:
forum kanalının (movie releases) bot rolüne **erişimi** ve **Manage Threads** yetkisi olsun.

## 3. Forum kanal ID'sini al

1. Discord → **Kullanıcı Ayarları → Gelişmiş → Geliştirici Modu**'nu aç.
2. Forum kanalına (movie releases / türkçe-yamalar) **sağ tık → Kanal Kimliğini Kopyala**.
3. Bu değer senin `FORUM_CHANNEL_ID`'ndir.

## 4. Render'a gizli değişkenleri gir

Render panel → servisin → **Environment** → şunları ekle/doldur:

| Key | Değer |
|-----|-------|
| `BOT_TOKEN` | (1. adımda kopyaladığın token) |
| `FORUM_CHANNEL_ID` | (3. adımdaki kanal ID) |

(`TRENDING_TAG_NAME`, `TRENDING_TOP_N`, `TRENDING_INTERVAL_MIN` zaten varsayılanlı — dokunmana gerek yok.)

Kaydet → Render otomatik yeniden başlatır. Başlangıç logunda şunu görmelisin:

```
🏷️  Etiketler yüklendi (11): New Release, Trending, Featured, Classic, Global, Asia, EU, US, Multi Audio, Dubbed, Subbed
🔥 Trending açık: her 30 dk, en çok beğeni alan ilk 10 post etiketlenir.
```

---

## Çalışma mantığı

- **Yeni post** geldiğinde: `deriveTags` payload'dan etiket adlarını çıkarır
  (New Release + bölge/ses + açık `tags`), bot bunları kanaldaki gerçek ID'lere çevirip
  posta uygular. (Forum başına en fazla 5 etiket.)
- **Trending**: bot her 30 dk'da bir tüm postların beğenisini sayar, en çok beğeni alan
  ilk 10'a "Trending" etiketi ekler, gerisinden kaldırır. Böylece "Trending"e tıklayan
  en popüler içerikleri görür.

> ⚠️ Render ücretsiz planı boştayken uyur; uyurken Trending döngüsü de durur. Kendi VPS'inde
> (sürekli açık) sorunsuz çalışır. Render'da uyanık tutmak için UptimeRobot eklenebilir.

## Notlar

- Etiket adları kanaldakiyle **birebir aynı olmasa da** olur (büyük/küçük harf, boşluk farkı tolere edilir),
  ama kanalda **olmayan** bir etiket yok sayılır. Yeni etiket eklersen bot yeniden başlatılınca tanır.
- Bot Token'ı yoksa veya kanal ID boşsa: bot eskisi gibi sadece webhook ile çalışır (etiketsiz). Hata vermez.
