import test from "node:test";
import assert from "node:assert/strict";
import { readEvents } from "../src/lib/life-stream.ts";
test("stream parser preserves split Turkish UTF-8 and split CRLF events", async () => {
  const bytes = new TextEncoder().encode(
    'event: phase\r\ndata: {"phase":"searching"}\r\n\r\nevent: answer\r\ndata: {"answer":"Öğrenci şifresi"}\r\n\r\n',
  );
  const stream = new ReadableStream<Uint8Array>({
    start(c) {
      for (const b of bytes) c.enqueue(new Uint8Array([b]));
      c.close();
    },
  });
  const events = [];
  for await (const event of readEvents(stream)) events.push(event);
  assert.equal(events.length, 2);
  assert.equal(events[1].data.answer, "Öğrenci şifresi");
});
