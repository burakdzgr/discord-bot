// Bir içerik payload'unu işleyip doğru kanala gönderen ortak boru hattı.
// Hem callback endpoint'i (index.js) hem de JPV fetcher (jpvFetcher.js) bunu kullanır.

import { extractContent, deriveTags } from "./extractor.js";
import { resolveRoute } from "./config.js";
import { tagIdsFor } from "./discordBot.js";
import { sendToDiscord } from "./discord.js";

export async function processContent(payload) {
  const content = extractContent(payload);

  // type (ya da algılanan kategori) -> hangi kanala gideceğini belirle.
  const route = resolveRoute(content.type, content.category.key);
  if (!route) {
    throw new Error(`'${content.type || content.category.label}' türü için tanımlı kanal/webhook yok.`);
  }

  const tagNames = deriveTags(payload);
  const tagIds = tagIdsFor(route.channelId, tagNames); // bot token kapalıysa boş
  await sendToDiscord(route, content, payload, tagIds);

  return { content, route, tagNames };
}
