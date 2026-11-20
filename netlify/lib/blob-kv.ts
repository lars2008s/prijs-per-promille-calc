import { getStore } from "@netlify/blobs";
import type { KV } from "../../shared/analytics-core.ts";

/** Netlify Blobs as the analytics key/value store. */
export function blobKV(): KV {
  const store = getStore({ name: "analytics", consistency: "strong" });
  return {
    async set(key, value) {
      await store.set(key, value);
    },
    async list(prefix) {
      const keys: string[] = [];
      for await (const page of store.list({ prefix, paginate: true })) {
        for (const b of page.blobs) keys.push(b.key);
      }
      return keys;
    },
  };
}

export const DEFAULT_HOSTS = [
  "ppp.larsschrijvers.be",
  "prijs-per-promille.netlify.app",
  "*--prijs-per-promille.netlify.app",
  "localhost",
  "127.0.0.1",
];
