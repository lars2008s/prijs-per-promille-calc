// Usage: OPENAI_API_KEY=... node scripts/bench.ts model1,model2 [effort] [detail]
import { readFileSync } from "node:fs";
import { buildOpenAIRequest } from "../shared/scan-core.ts";

const TRUTH: Record<string, [string, number][]> = {
  "menu-page1": [["jupiler", 2.8], ["jupiler", 3.6], ["jupiler", 5.2], ["stella", 2.9], ["hoegaarden", 3.4], ["leffe", 4.6], ["pitcher", 15], ["duvel", 4.9], ["westmalle", 5.2], ["kwak", 5.5], ["kasteel", 5.4], ["orval", 5.8], ["rodenbach", 3.9], ["karmeliet", 5.3], ["bush", 5.9]],
  "menu-page2": [["huiswijn", 5], ["huiswijn", 24], ["cava", 7.5], ["martini", 5.5], ["porto", 5], ["aperol", 10.5], ["gin", 11], ["bacardi", 9.5], ["jenever", 3.5], ["whisky", 8], ["limoncello", 5], ["jäger", 4]],
};

const models = (process.argv[2] ?? "gpt-6-luna").split(",");
const effort = (process.argv[3] ?? "low") as any;
const detail = (process.argv[4] ?? "high") as any;
const key = process.env.OPENAI_API_KEY!;

async function run(model: string, fixture: string) {
  const img = readFileSync(`tests/fixtures/${fixture}.jpg`).toString("base64");
  const body = buildOpenAIRequest(`data:image/jpeg;base64,${img}`, { model, reasoningEffort: effort === "null" ? null : effort, detail });
  const t0 = performance.now();
  const res = await fetch("https://api.openai.com/v1/responses", { method: "POST", headers: { authorization: `Bearer ${key}`, "content-type": "application/json" }, body: JSON.stringify(body) });
  if (!res.ok) return console.log(model, fixture, "HTTP", res.status, (await res.text()).slice(0, 300));
  const reader = res.body!.pipeThrough(new TextDecoderStream()).getReader();
  let buf = "", text = "", first = 0, usage: any = null;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += value;
    let i;
    while ((i = buf.indexOf("\n\n")) >= 0) {
      const chunk = buf.slice(0, i); buf = buf.slice(i + 2);
      const data = chunk.split("\n").filter(l => l.startsWith("data:")).map(l => l.slice(5).trim()).join("");
      if (!data || data === "[DONE]") continue;
      const ev = JSON.parse(data);
      if (ev.type === "response.output_text.delta") { if (!first) first = performance.now(); text += ev.delta; }
      if (ev.type === "response.completed") usage = ev.response.usage;
      if (ev.type === "error" || ev.type === "response.failed") console.log("ERR", JSON.stringify(ev).slice(0, 300));
    }
  }
  const t1 = performance.now();
  let out: any; try { out = JSON.parse(text); } catch { return console.log(model, fixture, "bad json", text.slice(0, 200)); }
  const truth = TRUTH[fixture];
  const used = new Set<number>();
  let hit = 0;
  for (const [n, p] of truth) {
    const idx = out.drinks.findIndex((d: any, j: number) => !used.has(j) && d.name.toLowerCase().includes(n) && Math.abs(d.priceEur - p) < 0.01);
    if (idx >= 0) { used.add(idx); hit++; }
  }
  console.log(`${model.padEnd(14)} ${fixture} first=${((first - t0) / 1000).toFixed(1)}s total=${((t1 - t0) / 1000).toFixed(1)}s drinks=${out.drinks.length} correct=${hit}/${truth.length} in=${usage?.input_tokens} out=${usage?.output_tokens} reas=${usage?.output_tokens_details?.reasoning_tokens} warn="${out.warning}"`);
  if (process.env.VERBOSE) for (const d of out.drinks) console.log("   ", d.name, "|", d.serving, "|", d.priceEur, "|", d.volumeMl, d.volumeSource, "|", d.abv, d.abvSource, "|", d.category, "|", d.note);
}

for (const m of models) await Promise.all(["menu-page1", "menu-page2"].map(f => run(m, f)));
