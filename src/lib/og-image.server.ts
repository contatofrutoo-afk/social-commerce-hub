/**
 * Compõe a imagem de preview (Open Graph) de um estabelecimento:
 * logotipo centralizado sobre um card 1200x630, tamanho exigido pelo
 * WhatsApp/Facebook/X — logos pequenos (ex.: 125x95) são ignorados por eles.
 */
import UPNG from "upng-js";
import jpeg from "jpeg-js";

export const OG_WIDTH = 1200;
export const OG_HEIGHT = 630;

type Rgba = { data: Uint8Array; width: number; height: number };

function decode(bytes: Uint8Array): Rgba | null {
  try {
    const isPng =
      bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
    if (isPng) {
      const img = UPNG.decode(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer);
      const rgba = new Uint8Array(UPNG.toRGBA8(img)[0]);
      return { data: rgba, width: img.width, height: img.height };
    }
    const isJpeg = bytes[0] === 0xff && bytes[1] === 0xd8;
    if (isJpeg) {
      const img = jpeg.decode(bytes, { useTArray: true, formatAsRGBA: true });
      return { data: new Uint8Array(img.data), width: img.width, height: img.height };
    }
  } catch {
    return null;
  }
  return null;
}

function hexToRgb(hex: string): [number, number, number] {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return [255, 255, 255];
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Retorna um PNG 1200x630 com o logotipo ampliado e centralizado. */
export function buildOgPng(logoBytes: Uint8Array, bgHex: string): Uint8Array | null {
  const src = decode(logoBytes);
  if (!src) return null;

  const [br, bg, bb] = hexToRgb(bgHex);
  const canvas = new Uint8Array(OG_WIDTH * OG_HEIGHT * 4);
  for (let i = 0; i < OG_WIDTH * OG_HEIGHT; i++) {
    canvas[i * 4] = br;
    canvas[i * 4 + 1] = bg;
    canvas[i * 4 + 2] = bb;
    canvas[i * 4 + 3] = 255;
  }

  // Escala o logo para caber com respiro (85% da altura útil).
  const maxW = OG_WIDTH * 0.72;
  const maxH = OG_HEIGHT * 0.66;
  const scale = Math.min(maxW / src.width, maxH / src.height);
  const dw = Math.max(1, Math.round(src.width * scale));
  const dh = Math.max(1, Math.round(src.height * scale));
  const ox = Math.round((OG_WIDTH - dw) / 2);
  const oy = Math.round((OG_HEIGHT - dh) / 2);

  for (let y = 0; y < dh; y++) {
    const sy = Math.min(src.height - 1, Math.floor((y / dh) * src.height));
    for (let x = 0; x < dw; x++) {
      const sx = Math.min(src.width - 1, Math.floor((x / dw) * src.width));
      const si = (sy * src.width + sx) * 4;
      const di = ((oy + y) * OG_WIDTH + (ox + x)) * 4;
      const a = src.data[si + 3] / 255;
      if (a <= 0) continue;
      canvas[di] = Math.round(src.data[si] * a + canvas[di] * (1 - a));
      canvas[di + 1] = Math.round(src.data[si + 1] * a + canvas[di + 1] * (1 - a));
      canvas[di + 2] = Math.round(src.data[si + 2] * a + canvas[di + 2] * (1 - a));
      canvas[di + 3] = 255;
    }
  }

  const out = UPNG.encode([canvas.buffer as ArrayBuffer], OG_WIDTH, OG_HEIGHT, 256);
  return new Uint8Array(out);
}
