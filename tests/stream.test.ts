import { describe, expect, it } from "vitest";
import { DrinkStreamParser, readSSE } from "../src/lib/stream.ts";

const doc = JSON.stringify({
  drinks: [
    { name: 'Gin "Bombay" {special}', priceEur: 11, note: "a ] tricky [ note \\ ok" },
    { name: "Duvel", priceEur: 4.9, note: "" },
    { name: "Kwak", priceEur: 5.5, note: "}" },
  ],
  warning: "",
});

describe("DrinkStreamParser", () => {
  it("emits every object exactly once regardless of chunk boundaries", () => {
    for (let size = 1; size <= 23; size++) {
      const p = new DrinkStreamParser();
      const out: unknown[] = [];
      for (let i = 0; i < doc.length; i += size) out.push(...p.push(doc.slice(i, i + size)));
      expect(out.map((o) => (o as { name: string }).name)).toEqual(['Gin "Bombay" {special}', "Duvel", "Kwak"]);
      expect(JSON.parse(p.fullText).drinks).toHaveLength(3);
    }
  });

  it("emits a drink as soon as its closing brace arrives", () => {
    const p = new DrinkStreamParser();
    expect(p.push('{"drinks":[{"name":"A"},{"na')).toHaveLength(1);
    expect(p.push('me":"B"}')).toHaveLength(1);
    expect(p.push('],"warning":""}')).toHaveLength(0);
  });
});

describe("readSSE", () => {
  it("parses events split across chunks, LF and CRLF", async () => {
    const raw =
      'event: a\ndata: {"type":"response.output_text.delta","delta":"x"}\n\n' +
      'event: b\r\ndata: {"type":"response.completed"}\r\n\r\n';
    const enc = new TextEncoder();
    const body = new ReadableStream<Uint8Array>({
      start(c) {
        for (let i = 0; i < raw.length; i += 7) c.enqueue(enc.encode(raw.slice(i, i + 7)));
        c.close();
      },
    });
    const types: string[] = [];
    for await (const ev of readSSE(body)) types.push(ev.type);
    expect(types).toEqual(["response.output_text.delta", "response.completed"]);
  });
});
