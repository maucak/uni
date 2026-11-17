import { prepareModels } from "../server/services/rag/models.ts";
const start = Date.now();
await prepareModels();
console.log(
  `Yerel arama modelleri hazır (${Math.round((Date.now() - start) / 1000)} sn). Model dosyaları var/models içinde.`,
);
