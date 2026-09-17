/**
 * Genera los logos del widget "Seguimiento con IA" con la identidad de holos.
 *
 *   node tools/gen-logos.js images
 *
 * Mismo motivo de dos globos de chat que "Exportar Conversación" (mismo
 * origen de marca/holos), pero con un pictograma propio: una chispa de
 * cuatro puntas (IA) en vez de la flecha de descarga, para distinguir los
 * dos widgets en la lista de integraciones de Kommo.
 * El logotipo "holos" NO se redibuja: se compone desde tools/brand/, extraído
 * de los originales por tools/extract-brand.js (compartido con el otro widget).
 */
const fs = require('fs');
const path = require('path');
const png = require('./png');

// ─── Paleta de marca (muestreada de los logos originales) ───────────────────

const BG      = '#302663'; // violeta de fondo
const WHITE   = '#fcfcfb'; // blanco calido del pictograma
const LAVENDER = '#a9a5bc'; // lavanda secundario (era el sobre)
const ACCENT  = '#f52655'; // acento, la chispa secundaria de IA
// Divisor vertical de logo_main: dos columnas de tono distinto.
const DIVIDER = ['#332f48', '#312c50'];

const hex = (s) => [
  parseInt(s.slice(1, 3), 16) / 255,
  parseInt(s.slice(3, 5), 16) / 255,
  parseInt(s.slice(5, 7), 16) / 255
];

// ─── Rasterizador (antialiasing por supermuestreo 4x4) ──────────────────────

const SS = 4;

function canvas(w, h, bg) {
  const c = { w: w, h: h, px: new Float64Array(w * h * 4) };
  if (bg) {
    const col = hex(bg);
    for (let i = 0; i < w * h; i++) {
      c.px[i*4] = col[0]; c.px[i*4+1] = col[1]; c.px[i*4+2] = col[2]; c.px[i*4+3] = 1;
    }
  }
  return c;
}

function fill(c, bbox, inside, colorHex) {
  const col = hex(colorHex);
  const x0 = Math.max(0, Math.floor(bbox[0]));
  const y0 = Math.max(0, Math.floor(bbox[1]));
  const x1 = Math.min(c.w, Math.ceil(bbox[2]));
  const y1 = Math.min(c.h, Math.ceil(bbox[3]));
  const step = 1 / SS;
  const total = SS * SS;

  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      let hits = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          if (inside(x + (sx + 0.5) * step, y + (sy + 0.5) * step)) hits++;
        }
      }
      if (!hits) continue;

      const a = hits / total;
      const i = (y * c.w + x) * 4;
      const da = c.px[i + 3];
      const oa = a + da * (1 - a);
      for (let k = 0; k < 3; k++) {
        c.px[i + k] = oa === 0 ? 0 : (col[k] * a + c.px[i + k] * da * (1 - a)) / oa;
      }
      c.px[i + 3] = oa;
    }
  }
}

function toBytes(c) {
  const out = new Uint8Array(c.w * c.h * 4);
  for (let i = 0; i < out.length; i++) {
    out[i] = Math.round(Math.min(1, Math.max(0, c.px[i])) * 255);
  }
  return out;
}

function blit(c, img, dx, dy) {
  for (let y = 0; y < img.h; y++) {
    const ty = dy + y;
    if (ty < 0 || ty >= c.h) continue;
    for (let x = 0; x < img.w; x++) {
      const tx = dx + x;
      if (tx < 0 || tx >= c.w) continue;
      const s = (y * img.w + x) * 4;
      const a = img.rgba[s + 3] / 255;
      if (!a) continue;
      const i = (ty * c.w + tx) * 4;
      const da = c.px[i + 3];
      const oa = a + da * (1 - a);
      for (let k = 0; k < 3; k++) {
        const sc = img.rgba[s + k] / 255;
        c.px[i + k] = oa === 0 ? 0 : (sc * a + c.px[i + k] * da * (1 - a)) / oa;
      }
      c.px[i + 3] = oa;
    }
  }
}

// ─── Formas ─────────────────────────────────────────────────────────────────

function roundedRect(x, y, w, h, r) {
  r = Math.max(0, Math.min(r, w / 2, h / 2));
  return function (px, py) {
    if (px < x || px > x + w || py < y || py > y + h) return false;
    const dx = Math.max(x + r - px, 0, px - (x + w - r));
    const dy = Math.max(y + r - py, 0, py - (y + h - r));
    return dx === 0 || dy === 0 || dx * dx + dy * dy <= r * r;
  };
}

function triangle(ax, ay, bx, by, cx, cy) {
  const d = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy);
  return function (px, py) {
    const u = ((by - cy) * (px - cx) + (cx - bx) * (py - cy)) / d;
    const v = ((cy - ay) * (px - cx) + (ax - cx) * (py - cy)) / d;
    return u >= 0 && v >= 0 && u + v <= 1;
  };
}

function diamond(cx, cy, hw, hh) {
  return function (px, py) {
    return Math.abs(px - cx) / hw + Math.abs(py - cy) / hh <= 1;
  };
}

function sparkle(cx, cy, R, thin) {
  const v = diamond(cx, cy, thin, R);
  const h = diamond(cx, cy, R, thin);
  return function (px, py) { return v(px, py) || h(px, py); };
}

// ─── Pictograma ─────────────────────────────────────────────────────────────

function frontBubble(c, ox, oy, S, e, color) {
  const x = ox + 0.05 * S - e;
  const y = oy + 0.30 * S - e;
  const w = 0.67 * S + 2 * e;
  const h = 0.46 * S + 2 * e;

  fill(c, [x, y, x + w, y + h],
       roundedRect(x, y, w, h, 0.105 * S + e), color);

  const t = e * 1.2;
  fill(c, [ox, oy + 0.65 * S, ox + 0.45 * S, oy + 0.95 * S],
       triangle(ox + 0.17 * S - t, oy + 0.70 * S,
                ox + 0.35 * S + t, oy + 0.70 * S,
                ox + 0.145 * S - t * 1.7, oy + 0.885 * S + t * 1.7), color);
}

function drawPictogram(c, ox, oy, S) {
  fill(c, [ox + 0.38 * S, oy + 0.07 * S, ox + 0.95 * S, oy + 0.46 * S],
       roundedRect(ox + 0.40 * S, oy + 0.09 * S, 0.53 * S, 0.34 * S, 0.085 * S),
       LAVENDER);

  frontBubble(c, ox, oy, S, 0.035 * S, BG);
  frontBubble(c, ox, oy, S, 0, WHITE);

  const cx = ox + 0.385 * S;
  const cy = oy + 0.535 * S;
  fill(c, [cx - 0.16 * S, cy - 0.16 * S, cx + 0.16 * S, cy + 0.16 * S],
       sparkle(cx, cy, 0.155 * S, 0.045 * S), BG);

  const sx = ox + 0.565 * S;
  const sy = oy + 0.375 * S;
  fill(c, [sx - 0.07 * S, sy - 0.07 * S, sx + 0.07 * S, sy + 0.07 * S],
       sparkle(sx, sy, 0.065 * S, 0.02 * S), ACCENT);
}

// ─── Composicion de cada tamano ─────────────────────────────────────────────

const OUT = path.resolve(process.argv[2] || 'images');
const BRAND = path.join(__dirname, 'brand');
fs.mkdirSync(OUT, { recursive: true });

const SIZES = [
  ['logo_min.png',    84,  84,  70,   7,   7, null],
  ['logo_small.png', 108, 108,  86,  11,  11, null],
  ['logo.png',       130, 100,  84,  23,   8, null],
  ['logo_dp.png',    174, 109,  74,   0,  18, ['wordmark-dp.png',      72]],
  ['logo_medium.png',240,  84,  74,   8,   5, ['wordmark-medium.png',  91]],
  ['logo_main.png',  400, 272, 118,   6,  77, ['wordmark-main.png',   161]]
];

for (const [name, w, h, S, ix, iy, mark] of SIZES) {
  const c = canvas(w, h, BG);

  drawPictogram(c, ix, iy, S);

  if (name === 'logo_main.png') {
    DIVIDER.forEach((col, k) => {
      fill(c, [131 + k, 0, 132 + k, h],
           roundedRect(131 + k, 0, 1, h, 0), col);
    });
  }

  if (mark) blit(c, png.decode(path.join(BRAND, mark[0])), mark[1], 0);

  const buf = png.encode(w, h, toBytes(c));
  fs.writeFileSync(path.join(OUT, name), buf);
  console.log(name.padEnd(17), w + 'x' + h, (buf.length / 1024).toFixed(1) + 'KB');
}
