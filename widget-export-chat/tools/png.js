/** Lectura y escritura de PNG de 8 bits, sin dependencias externas. */
const fs = require('fs');
const zlib = require('zlib');

const CRC_TABLE = (function () {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

/** Codifica RGBA (Uint8Array, w*h*4) a un buffer PNG. */
function encode(w, h, rgba) {
  const stride = w * 4;
  const raw = Buffer.alloc((stride + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (stride + 1)] = 0; // filtro "none"
    Buffer.from(rgba.buffer, rgba.byteOffset + y * stride, stride)
      .copy(raw, y * (stride + 1) + 1);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;  // profundidad
  ihdr[9] = 6;  // RGBA

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

/** Decodifica un PNG de 8 bits no entrelazado a { w, h, rgba }. */
function decode(file) {
  const b = fs.readFileSync(file);
  let pos = 8, idat = [], ihdr = null, plte = null, trns = null;

  while (pos < b.length) {
    const len = b.readUInt32BE(pos);
    const type = b.toString('ascii', pos + 4, pos + 8);
    const data = b.slice(pos + 8, pos + 8 + len);
    if (type === 'IHDR') ihdr = {
      w: data.readUInt32BE(0), h: data.readUInt32BE(4),
      depth: data[8], color: data[9], interlace: data[12]
    };
    else if (type === 'IDAT') idat.push(data);
    else if (type === 'PLTE') plte = data;
    else if (type === 'tRNS') trns = data;
    else if (type === 'IEND') break;
    pos += 12 + len;
  }

  if (ihdr.depth !== 8) throw new Error('profundidad ' + ihdr.depth + ' no soportada');
  if (ihdr.interlace) throw new Error('PNG entrelazado no soportado');

  const CH = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[ihdr.color];
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = ihdr.w * CH;
  const out = Buffer.alloc(stride * ihdr.h);

  for (let y = 0; y < ihdr.h; y++) {
    const ft = raw[y * (stride + 1)];
    const line = raw.slice(y * (stride + 1) + 1, y * (stride + 1) + 1 + stride);
    for (let i = 0; i < stride; i++) {
      const a = i >= CH ? out[y * stride + i - CH] : 0;
      const up = y > 0 ? out[(y - 1) * stride + i] : 0;
      const ul = (i >= CH && y > 0) ? out[(y - 1) * stride + i - CH] : 0;
      let v = line[i];
      if (ft === 1) v += a;
      else if (ft === 2) v += up;
      else if (ft === 3) v += (a + up) >> 1;
      else if (ft === 4) {
        const p = a + up - ul;
        const pa = Math.abs(p - a), pb = Math.abs(p - up), pc = Math.abs(p - ul);
        v += (pa <= pb && pa <= pc) ? a : (pb <= pc ? up : ul);
      }
      out[y * stride + i] = v & 0xff;
    }
  }

  const rgba = new Uint8Array(ihdr.w * ihdr.h * 4);
  for (let i = 0, n = ihdr.w * ihdr.h; i < n; i++) {
    let r, g, bl, al = 255;
    if (ihdr.color === 6) { r = out[i*4]; g = out[i*4+1]; bl = out[i*4+2]; al = out[i*4+3]; }
    else if (ihdr.color === 2) { r = out[i*3]; g = out[i*3+1]; bl = out[i*3+2]; }
    else if (ihdr.color === 3) {
      const p = out[i] * 3; r = plte[p]; g = plte[p+1]; bl = plte[p+2];
      if (trns && out[i] < trns.length) al = trns[out[i]];
    }
    else if (ihdr.color === 0) { r = g = bl = out[i]; }
    else if (ihdr.color === 4) { r = g = bl = out[i*2]; al = out[i*2+1]; }
    rgba[i*4] = r; rgba[i*4+1] = g; rgba[i*4+2] = bl; rgba[i*4+3] = al;
  }

  return { w: ihdr.w, h: ihdr.h, rgba };
}

module.exports = { encode, decode };
