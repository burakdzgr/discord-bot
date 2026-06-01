// PM2 ile VPS'te 7/24 çalıştırma config'i.
// Kullanım (VPS'te):  pm2 start ecosystem.config.cjs
// PM2 dosya tabanlı config'i CommonJS bekler; bu yüzden uzantı .cjs.
module.exports = {
  apps: [
    {
      name: "discord-archive-bot",
      script: "src/index.js",
      // .env'i dotenv zaten okuyor; PM2'ye ayrıca env vermeye gerek yok.
      instances: 1,
      autorestart: true,          // çökerse otomatik yeniden başlat
      max_restarts: 20,
      restart_delay: 3000,        // yeniden başlatmadan önce 3 sn bekle
      max_memory_restart: "256M", // bellek şişerse yeniden başlat
      watch: false,
      time: true,                 // log satırlarına zaman damgası ekle
      out_file: "logs/out.log",
      error_file: "logs/error.log",
    },
  ],
};
