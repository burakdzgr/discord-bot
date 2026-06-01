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

## 3. Kanalların webhook'larını ve ID'lerini al (4 kanal)

Her tür ayrı bir kanala gittiği için **her kanal için bir webhook + bir kanal ID** gerekiyor.

**Webhook (her kanal için):** İlgili forum kanalı → Ayarlar (dişli) → **Entegrasyonlar → Webhooks → Yeni Webhook** → adını/avatarını ayarla → **Webhook URL'sini kopyala**.

**Kanal ID (her kanal için):** **Kullanıcı Ayarları → Gelişmiş → Geliştirici Modu**'nu aç → kanala **sağ tık → Kanal Kimliğini Kopyala**.

## 4. Render'a gizli değişkenleri gir

Render panel → servisin → **Environment** → şunları doldur (kullandığın türler için):

| Key | Değer |
|-----|-------|
| `BOT_TOKEN` | 1. adımdaki token (tek token tüm kanalları yönetir) |
| `MOVIE_WEBHOOK_URL` / `MOVIE_CHANNEL_ID` | Film kanalı webhook + ID |
| `SERIES_WEBHOOK_URL` / `SERIES_CHANNEL_ID` | Dizi kanalı webhook + ID |
| `ANIME_WEBHOOK_URL` / `ANIME_CHANNEL_ID` | Anime kanalı webhook + ID |
| `ADULT_WEBHOOK_URL` / `ADULT_CHANNEL_ID` | Adult kanalı webhook + ID |

> `*_CHANNEL_ID` sadece **etiket/Trending** için gerekir; sadece webhook girersen post yine
> gider ama o kanalda etiket/Trending olmaz. `DISCORD_WEBHOOK_URL` (varsayılan) eşleşmeyen
> türler için yedektir.

**Botu davet ederken** (2. adım) botun **4 kanalın hepsinde** View Channels + Read Message
History + Manage Threads yetkisi olduğundan emin ol (kategori/rol izinleri kanal bazında).

Kaydet → Render otomatik yeniden başlatır. Başlangıç logunda her kanal için şunu görmelisin:

```
🏷️  [movie-releases] etiketler (11): New Release, Trending, Featured, ...
🔥 [movie-releases] Trending açık: her 30 dk, en çok beğeni alan ilk 10 post.
🏷️  [adult-releases] etiketler (...): ...
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
