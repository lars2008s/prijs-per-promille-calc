import { useCallback, useEffect, useRef, type Dispatch } from "react";
import { scanPhoto, ScanError } from "./lib/api.ts";
import { newId } from "./lib/drinks.ts";
import type { PreparedImage } from "./lib/image.ts";
import type { Action, Photo } from "./state.ts";
import { track } from "./lib/analytics.ts";

const MAX_PARALLEL = 3;

/** Uploads photos as soon as they are taken, a few at a time, streaming drinks into the state. */
export function useScanner(photos: Photo[], dispatch: Dispatch<Action>) {
  const images = useRef(new Map<string, string>());
  const started = useRef(new Set<string>());
  const controllers = useRef(new Map<string, AbortController>());

  const run = useCallback(
    async (id: string) => {
      const dataUrl = images.current.get(id);
      if (!dataUrl) {
        dispatch({ type: "photoStatus", id, status: "error", error: "Foto niet meer beschikbaar.", canRetry: false });
        return;
      }
      dispatch({ type: "photoStatus", id, status: "scanning" });
      const ctrl = new AbortController();
      controllers.current.set(id, ctrl);
      try {
        const result = await scanPhoto(dataUrl, {
          signal: ctrl.signal,
          onDrink: (drink) => dispatch({ type: "drinkFound", photoId: id, drink }),
        });
        const warning =
          result.warning ||
          (result.drinks.length === 0 ? "Geen alcoholische dranken met een prijs gevonden op deze foto." : "");
        dispatch({ type: "photoDone", id, warning });
        track("scan");
        images.current.delete(id);
      } catch (err) {
        if (ctrl.signal.aborted) return;
        dispatch({
          type: "photoStatus",
          id,
          status: "error",
          error: err instanceof ScanError ? err.message : "Onverwachte fout bij het lezen.",
          canRetry: true,
        });
      } finally {
        controllers.current.delete(id);
      }
    },
    [dispatch],
  );

  useEffect(() => {
    let slots = MAX_PARALLEL - photos.filter((p) => p.status === "scanning").length;
    for (const p of photos) {
      if (slots <= 0) break;
      if (p.status === "queued" && !started.current.has(p.id)) {
        started.current.add(p.id);
        slots--;
        void run(p.id);
      }
    }
  }, [photos, run]);

  // Abort everything on unmount.
  useEffect(() => {
    const ctrls = controllers.current;
    return () => ctrls.forEach((c) => c.abort());
  }, []);

  const add = useCallback(
    (img: PreparedImage) => {
      const id = newId();
      images.current.set(id, img.dataUrl);
      dispatch({
        type: "addPhoto",
        photo: { id, thumb: img.thumb, status: "queued", found: 0, createdAt: Date.now() },
      });
    },
    [dispatch],
  );

  const retry = useCallback(
    (id: string) => {
      if (!images.current.has(id)) return;
      started.current.delete(id);
      dispatch({ type: "photoStatus", id, status: "queued" });
    },
    [dispatch],
  );

  const remove = useCallback(
    (id: string) => {
      controllers.current.get(id)?.abort();
      images.current.delete(id);
      started.current.delete(id);
      dispatch({ type: "removePhoto", id });
    },
    [dispatch],
  );

  const reset = useCallback(() => {
    controllers.current.forEach((c) => c.abort());
    controllers.current.clear();
    images.current.clear();
    started.current.clear();
    dispatch({ type: "reset" });
  }, [dispatch]);

  return { add, retry, remove, reset };
}
