/**
 * Incrementally pulls complete drink objects out of a streamed JSON document
 * shaped like {"drinks":[{...},{...}],"warning":""}, so the ranking can grow
 * while the model is still writing.
 */
export class DrinkStreamParser {
  private text = "";
  private pos = 0;
  private inString = false;
  private escape = false;
  private depth = 0;
  private inDrinks = false;
  private drinksDone = false;
  private objStart = -1;

  get fullText(): string {
    return this.text;
  }

  push(delta: string): unknown[] {
    this.text += delta;
    const found: unknown[] = [];
    const t = this.text;
    for (; this.pos < t.length; this.pos++) {
      const c = t[this.pos];
      if (this.inString) {
        if (this.escape) this.escape = false;
        else if (c === "\\") this.escape = true;
        else if (c === '"') this.inString = false;
        continue;
      }
      if (c === '"') {
        this.inString = true;
      } else if (c === "{" || c === "[") {
        this.depth++;
        if (c === "[" && this.depth === 2 && !this.inDrinks && !this.drinksDone) this.inDrinks = true;
        else if (c === "{" && this.depth === 3 && this.inDrinks) this.objStart = this.pos;
      } else if (c === "}" || c === "]") {
        if (c === "}" && this.depth === 3 && this.inDrinks && this.objStart >= 0) {
          try {
            found.push(JSON.parse(t.slice(this.objStart, this.pos + 1)));
          } catch {
            /* malformed object: skip */
          }
          this.objStart = -1;
        } else if (c === "]" && this.depth === 2 && this.inDrinks) {
          this.inDrinks = false;
          this.drinksDone = true;
        }
        this.depth--;
      }
    }
    return found;
  }
}

export interface SSEEvent {
  type: string;
  [key: string]: unknown;
}

/** Parses a text/event-stream body into JSON events. */
export async function* readSSE(body: ReadableStream<Uint8Array>): AsyncGenerator<SSEEvent> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      // Normalise on the whole buffer so a CRLF split across chunks is still caught.
      buf = (buf + decoder.decode(value, { stream: true })).replace(/\r\n/g, "\n");
      let i: number;
      while ((i = buf.indexOf("\n\n")) >= 0) {
        const ev = parseBlock(buf.slice(0, i));
        buf = buf.slice(i + 2);
        if (ev) yield ev;
      }
    }
    const tail = parseBlock(buf);
    if (tail) yield tail;
  } finally {
    reader.releaseLock();
  }
}

function parseBlock(block: string): SSEEvent | null {
  const data = block
    .split("\n")
    .filter((l) => l.startsWith("data:"))
    .map((l) => l.slice(5).trimStart())
    .join("\n");
  if (!data || data === "[DONE]") return null;
  try {
    const ev = JSON.parse(data) as SSEEvent;
    return typeof ev?.type === "string" ? ev : null;
  } catch {
    return null;
  }
}
