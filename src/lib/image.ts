export const MAX_SIDE = 1600;
const THUMB_SIDE = 220;

export interface PreparedImage {
  dataUrl: string;
  thumb: string;
}

function fit(w: number, h: number, max: number) {
  const s = Math.min(1, max / Math.max(w, h));
  return { w: Math.max(1, Math.round(w * s)), h: Math.max(1, Math.round(h * s)) };
}

function draw(source: CanvasImageSource, sw: number, sh: number, max: number, quality: number): string {
  const { w, h } = fit(sw, sh, max);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas niet beschikbaar");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(source, 0, 0, w, h);
  return canvas.toDataURL("image/jpeg", quality);
}

/** Scales a camera frame or picked file down to something the API reads well and uploads fast. */
export function prepareFromSource(source: CanvasImageSource, width: number, height: number): PreparedImage {
  return {
    dataUrl: draw(source, width, height, MAX_SIDE, 0.85),
    thumb: draw(source, width, height, THUMB_SIDE, 0.7),
  };
}

async function loadImage(file: Blob): Promise<{ source: CanvasImageSource; w: number; h: number; done: () => void }> {
  if ("createImageBitmap" in window) {
    try {
      const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
      return { source: bmp, w: bmp.width, h: bmp.height, done: () => bmp.close() };
    } catch {
      /* fall back to <img> (e.g. older Safari) */
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = "async";
    img.src = url;
    await img.decode();
    return { source: img, w: img.naturalWidth, h: img.naturalHeight, done: () => URL.revokeObjectURL(url) };
  } catch {
    URL.revokeObjectURL(url);
    throw new Error("Deze afbeelding kan niet geopend worden.");
  }
}

export async function prepareFromFile(file: Blob): Promise<PreparedImage> {
  const { source, w, h, done } = await loadImage(file);
  try {
    return prepareFromSource(source, w, h);
  } finally {
    done();
  }
}
