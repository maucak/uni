import { ApiError } from "./api.ts";
import type { LifeAnswer, LifeArticle } from "../../shared/life";
export type LifeStreamEvent = { event: string; data: any };
// Preserve UTF-8 characters and event boundaries across arbitrary network chunks.
export async function* readEvents(
  body: ReadableStream<Uint8Array>,
): AsyncGenerator<LifeStreamEvent> {
  const reader = body.getReader(),
    decoder = new TextDecoder();
  let buffer = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      buffer = (buffer + decoder.decode(value, { stream: !done })).replace(
        /\r\n/g,
        "\n",
      );
      let boundary: number;
      while ((boundary = buffer.indexOf("\n\n")) >= 0) {
        const block = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);
        const event = block
          .split("\n")
          .find((l) => l.startsWith("event:"))
          ?.slice(6)
          .trim();
        const data = block
          .split("\n")
          .filter((l) => l.startsWith("data:"))
          .map((l) => l.slice(5).trim())
          .join("\n");
        if (event && data) yield { event, data: JSON.parse(data) };
      }
      if (done) break;
    }
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
export async function askLife(
  payload: {
    message: string;
    requestId: string;
    conversationId: string | null;
  },
  onSources: (sources: LifeArticle[]) => void,
  onPhase: (phase: string) => void,
): Promise<LifeAnswer> {
  const response = await fetch("/api/v1/life/ask?stream=1", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "text/event-stream",
    },
    credentials: "same-origin",
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const data = await response
      .json()
      .catch(() => ({ message: "Sunucuya ulaşılamadı." }));
    throw new ApiError(
      response.status,
      data.message,
      data.code || "HTTP_ERROR",
    );
  }
  if (!response.body) throw new Error("Yanıt akışı açılamadı.");
  for await (const packet of readEvents(response.body)) {
    if (packet.event === "sources") onSources(packet.data.sources);
    if (packet.event === "phase") onPhase(packet.data.phase);
    if (packet.event === "error")
      throw new ApiError(500, packet.data.message, packet.data.code);
    if (packet.event === "answer") return packet.data as LifeAnswer;
  }
  throw new Error(
    "Bağlantı yanıt tamamlanmadan kesildi. Aynı mesajı yeniden gönderebilirsin.",
  );
}
