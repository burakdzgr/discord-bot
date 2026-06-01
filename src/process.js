// Bir içerik payload'unu işleyip doğru kanala gönderen ortak boru hattı.
// Hem callback endpoint'i (index.js) hem de JPV fetcher (jpvFetcher.js) bunu kullanır.

import { extractContent } from "./extractor.js";
import { resolveRoute } from "./config.js";
import { sendToDiscord } from "./discord.js";

export async function processContent(payload) {
  const content = extractContent(payload);

  // type (ya da algılanan kategori) -> hangi kanala gideceğini belirle.
  const route = resolveRoute(content.type, content.category.key);
  if (!route) {
    throw new Error(`'${content.type || content.category.label}' türü için tanımlı kanal/webhook yok.`);
  }

  await sendToDiscord(route, content, payload);

  return { content, route };
}
