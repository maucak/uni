import { resolve } from "node:path";
export const embeddingModel = "Xenova/multilingual-e5-small";
export const rerankerModel = "onnx-community/bge-reranker-v2-m3-ONNX";
export const modelRevision = "761b726dd34fb83930e26aab4e9ac3899aa1fa78";
export const rerankerRevision = "6f5ff65298512715a1e669753bc754d2bc8f367b";
export const embeddingKey = `${embeddingModel}:${modelRevision}`;
let extractor: Promise<any> | undefined,
  reranker: Promise<{ tokenizer: any; model: any }> | undefined;
let queue: Promise<unknown> = Promise.resolve();
// Serialize CPU inference across requests; never load/execute concurrent models unboundedly.
function serial<T>(task: () => Promise<T>): Promise<T> {
  const next = queue.then(task, task);
  queue = next.catch(() => {});
  return next;
}
async function runtime(download: boolean) {
  const t = await import("@huggingface/transformers");
  t.env.cacheDir = resolve("var/models");
  t.env.allowRemoteModels = download;
  // Files are prepared explicitly, not downloaded inside a user request.
  return t;
}
async function getExtractor(download = false) {
  if (!extractor) {
    extractor = (async () => {
      const t = await runtime(download);
      return t.pipeline(
        "feature-extraction",
        download
          ? embeddingModel
          : resolve("var/models", embeddingModel, modelRevision),
        {
          dtype: "q8",
          device: "cpu",
          revision: modelRevision,
          session_options: { intraOpNumThreads: 2, interOpNumThreads: 1 },
          local_files_only: !download,
        },
      );
    })().catch((e) => {
      extractor = undefined;
      throw e;
    });
  }
  return extractor;
}
async function getReranker(download = false) {
  if (!reranker) {
    reranker = (async () => {
      const t = await runtime(download);
      return {
        tokenizer: await t.AutoTokenizer.from_pretrained(
          download
            ? rerankerModel
            : resolve("var/models", rerankerModel, rerankerRevision),
          { revision: rerankerRevision, local_files_only: !download },
        ),
        model: await t.AutoModelForSequenceClassification.from_pretrained(
          download
            ? rerankerModel
            : resolve("var/models", rerankerModel, rerankerRevision),
          {
            dtype: "q8",
            device: "cpu",
            revision: rerankerRevision,
            session_options: { intraOpNumThreads: 2, interOpNumThreads: 1 },
            local_files_only: !download,
          },
        ),
      };
    })().catch((e) => {
      reranker = undefined;
      throw e;
    });
  }
  return reranker;
}
export async function embed(
  texts: string[],
  kind: "query" | "passage",
  download = false,
): Promise<number[][]> {
  return serial(async () => {
    const model = await getExtractor(download);
    const output = await model(
      texts.map((text) => `${kind}: ${text}`),
      { pooling: "mean", normalize: true, truncation: true, max_length: 512 },
    );
    const values = output.tolist() as number[][];
    if (
      values.length !== texts.length ||
      values.some((v) => v.length !== 384 || v.some((n) => !Number.isFinite(n)))
    )
      throw new Error("Embedding dimensions invalid");
    return values;
  });
}
export async function rerank(
  query: string,
  texts: string[],
  download = false,
): Promise<number[]> {
  if (!texts.length) return [];
  return serial(async () => {
    const { tokenizer, model } = await getReranker(download);
    const inputs = await tokenizer(
      texts.map(() => query),
      { text_pair: texts, padding: true, truncation: true, max_length: 384 },
    );
    const { logits } = await model(inputs);
    const rows = logits.tolist() as number[][];
    const values = rows.map((row) => 1 / (1 + Math.exp(-row[0])));
    if (
      values.length !== texts.length ||
      values.some((n) => !Number.isFinite(n))
    )
      throw new Error("Reranker scores invalid");
    return values;
  });
}
export async function prepareModels() {
  await embed(
    ["Öğrenci yurt başvurusu e-Devlet üzerinden yapılır."],
    "passage",
    true,
  );
  await rerank(
    "Yurt başvurusu nasıl yapılır?",
    ["Yurt başvuruları e-Devlet üzerinden yapılır."],
    true,
  );
}
