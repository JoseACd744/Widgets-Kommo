/**
 * Extrae el logotipo "holos" de los PNG originales para poder reusarlo tal cual
 * en los tamaños que lo llevan. Se corre una sola vez; el resultado queda
 * versionado en tools/brand/ y gen-logos.js lo compone.
 *
 *   node tools/extract-brand.js ../images
 */
const fs = require('fs');
const path = require('path');
const png = require('./png');

// [origen, x desde donde empieza el logotipo (a la derecha del pictograma), destino]
const CUTS = [
  ['logo_dp.png',      72, 'wordmark-dp.png'],
  ['logo_medium.png',  91, 'wordmark-medium.png'],
  ['logo_main.png',   161, 'wordmark-main.png']
];

const SRC = process.argv[2] || path.join(__dirname, '..', '..', 'images');
const OUT = path.join(__dirname, 'brand');
fs.mkdirSync(OUT, { recursive: true });

for (const [file, fromX, dest] of CUTS) {
  const img = png.decode(path.join(SRC, file));
  const w = img.w - fromX;
  const strip = new Uint8Array(w * img.h * 4);

  for (let y = 0; y < img.h; y++) {
    for (let x = 0; x < w; x++) {
      const s = (y * img.w + (x + fromX)) * 4;
      const d = (y * w + x) * 4;
      strip[d] = img.rgba[s];
      strip[d + 1] = img.rgba[s + 1];
      strip[d + 2] = img.rgba[s + 2];
      strip[d + 3] = img.rgba[s + 3];
    }
  }

  fs.writeFileSync(path.join(OUT, dest), png.encode(w, img.h, strip));
  console.log(dest.padEnd(22), w + 'x' + img.h, '(desde x=' + fromX + ' de ' + file + ')');
}
