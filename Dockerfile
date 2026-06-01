# Hafif Node imajı
FROM node:22-alpine

WORKDIR /app

# Önce bağımlılıklar (katman önbelleği için)
COPY package*.json ./
RUN npm install --omit=dev

# Uygulama kaynakları
COPY src ./src

# Bulut sağlayıcı PORT'u ortam değişkeniyle verir; kod onu okur.
ENV PORT=3000
EXPOSE 3000

CMD ["node", "src/index.js"]
