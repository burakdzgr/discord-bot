# Buluta Deploy (Discord engelini ve public URL ihtiyacını birlikte çözer)

Bu ağdan Discord'a doğrudan erişilemiyor (ISP engeli) **ve** dış arşiv sisteminin
callback URL'imize ulaşabilmesi için public bir adres gerekiyor. İkisini de bir
ücretsiz bulut host çözer. Aşağıda en kolay iki seçenek var.

> Hangi yöntemi seçersen seç, **webhook URL'ini repoya koyma** — host panelinden
> `DISCORD_WEBHOOK_URL` ortam değişkeni olarak gir (`.env` zaten `.gitignore`'da).

---

## Seçenek A — Render.com (önerilen, ücretsiz)

1. Kodu bir GitHub reposuna yükle (aşağıda "GitHub'a yükleme" adımları var).
2. https://render.com → hesap aç → **New > Blueprint** → repoyu seç.
   - `render.yaml` otomatik okunur.
3. Açılan ekranda ortam değişkenlerini gir:
   - `DISCORD_WEBHOOK_URL` = senin webhook adresin
   - (isteğe bağlı) `CALLBACK_SECRET` = güvenlik açmak istersen
4. Deploy bitince Render sana bir adres verir, örn:
   `https://discord-archive-bot.onrender.com`
5. **Dış arşiv sistemine vereceğin callback URL:**
   `https://discord-archive-bot.onrender.com/callback`

> Render free plan'da servis bir süre istek almazsa "uyur"; ilk istek onu uyandırır
> (birkaç saniye gecikme). Sürekli uyanık kalması gerekiyorsa ücretli plan ya da
> bir "ping" servisi (UptimeRobot vb.) eklenir.

---

## Seçenek B — Railway.app (uyumaz, küçük ücretsiz kota)

1. Kodu GitHub'a yükle.
2. https://railway.app → **New Project > Deploy from GitHub repo**.
3. Variables sekmesinden `DISCORD_WEBHOOK_URL` (ve istersen `CALLBACK_SECRET`) ekle.
4. Settings > Networking > **Generate Domain** ile public adres al.
5. Callback URL: `https://<verilen-domain>/callback`

Railway `Dockerfile`'ı otomatik kullanır (repoda mevcut).

---

## GitHub'a yükleme (her iki seçenek için ön adım)

```bash
git init
git add .
git commit -m "Arşiv -> Discord botu"
# GitHub'da boş bir repo oluştur, sonra:
git remote add origin https://github.com/<kullanici>/<repo>.git
git branch -M main
git push -u origin main
```

`.env` ve `node_modules` `.gitignore` sayesinde yüklenmez — webhook adresin gizli kalır.

---

## Deploy sonrası test

Public adres geldikten sonra (örnek Render):

```bash
curl -X POST https://discord-archive-bot.onrender.com/callback ^
  -H "Content-Type: application/json" ^
  -d "{\"baslik\":\"Test Filmi\",\"tur\":\"Film\",\"aciklama\":\"Deploy testi\"}"
```

Discord kanalında mesajı görürsen kurulum tamam. Bu adresi dış arşiv sistemine
"yeni içerik eklendiğinde POST at" diyerek verebilirsin.
