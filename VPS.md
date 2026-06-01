# Kendi VPS'ine Kurulum (kalıcı, 7/24)

Bu rehber botu yurt dışı bir Linux VPS'te (Ubuntu/Debian örnek) sürekli çalıştırır.
İki yöntem var: **PM2** (kolay) veya **systemd** (servis dosyası `deploy/` içinde). Aşağıda PM2 anlatılıyor.

> Neden VPS? Discord engelini aşar (sunucu yurt dışında) **ve** dış arşiv sisteminin
> ulaşabileceği public bir adres sağlar.

---

## 1. Sunucuya bağlan ve Node kur

```bash
ssh kullanici@SUNUCU_IP

# Node 22 (nodesource)
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs git
node -v    # v22.x görmelisin
```

## 2. Kodu çek

```bash
cd ~
git clone https://github.com/burakdzgr/discord-bot.git
cd discord-bot
npm install --omit=dev
```

## 3. Ortam değişkenlerini ayarla (.env)

`.env` repoda yok (gizli). Sunucuda elle oluştur. Aşağıyı yapıştır, sonra
`XXXX/YYYY`, kanal webhook'ları, ID'ler ve token'ı kendi değerlerinle doldur:

```bash
cat > .env <<'EOF'
PORT=3000

# Kimlik
BOT_USERNAME=Drakkar Archive
BOT_AVATAR_URL=

# Varsayılan webhook (type eşleşmezse buraya düşer)
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/XXXX/YYYY
FORUM_CHANNEL_ID=

# Tür bazlı kanallar (kullandıklarını doldur, gerisini boş bırak)
# *_CHANNEL_ID forum kanalı için (post başlığı doğrudan gönderilsin diye); webhook tek başına yeter.
MOVIE_WEBHOOK_URL=
MOVIE_CHANNEL_ID=
SERIES_WEBHOOK_URL=
SERIES_CHANNEL_ID=
ANIME_WEBHOOK_URL=
ANIME_CHANNEL_ID=
ADULT_WEBHOOK_URL=
ADULT_CHANNEL_ID=

# JPV video API'sinden otomatik çekme (dolunca: ilk turda son 10 video + sonra yeniler)
JPV_EMAIL=
JPV_PASSWORD=
JPV_API_BASE=https://japierdolevid.com/api/v1
JPV_POLL_MIN=5
JPV_SEED_COUNT=10

# Güvenlik (boşsa kapalı)
CALLBACK_SECRET=
EOF
```

> `nano .env` ile düzenleyebilirsin. Webhook için: ilgili kanal → Ayarlar → Entegrasyonlar → Webhooks → Yeni Webhook → URL'yi kopyala.
> `JPV_EMAIL`/`JPV_PASSWORD` dolunca bot videoları otomatik çeker. Güvenlik için `CALLBACK_SECRET`'a bir anahtar yaz.

## 4. PM2 ile başlat (7/24 + reboot sonrası otomatik)

```bash
sudo npm install -g pm2
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup        # çıktısındaki komutu kopyalayıp çalıştır (reboot'ta otomatik açılır)

pm2 logs discord-archive-bot   # canlı log
pm2 status
```

Bu noktada bot `http://SUNUCU_IP:3000/callback` adresinde çalışıyor.

## 5. (Önerilen) Nginx + HTTPS ile düzgün domain

Dış arşiv sistemi büyük ihtimalle `https://` ister. Bir (alt)domain'i sunucuna yönlendir, sonra:

```bash
sudo apt-get install -y nginx
sudo tee /etc/nginx/sites-available/discord-bot <<'EOF'
server {
    listen 80;
    server_name bot.senindomainin.com;   # kendi domainin
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
EOF
sudo ln -s /etc/nginx/sites-available/discord-bot /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx

# Ücretsiz HTTPS sertifikası
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d bot.senindomainin.com
```

Artık callback URL'in: `https://bot.senindomainin.com/callback`

## 6. Güncelleme (kod değişince)

```bash
cd ~/discord-bot
git pull
npm install --omit=dev
pm2 restart discord-archive-bot
```

## 7. Firewall (UFW kullanıyorsan)

```bash
sudo ufw allow 80
sudo ufw allow 443
# Nginx yoksa ve doğrudan 3000 kullanacaksan:
# sudo ufw allow 3000
```

---

### Test (kurulumdan sonra)

```bash
curl -X POST https://bot.senindomainin.com/callback \
  -H "Content-Type: application/json" \
  -d '{"baslik":"Test Filmi","tur":"Film","aciklama":"VPS testi"}'
```

Discord kanalında mesajı görürsen kurulum tamam. Bu adresi dış arşiv sistemine ver.
