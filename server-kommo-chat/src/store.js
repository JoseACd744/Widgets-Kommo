/**
 * Persistencia del par de tokens OAuth.
 *
 * Es un único JSON chico, así que va a un archivo dentro del volumen de Railway
 * (DATA_DIR). La escritura es atómica —archivo temporal + rename— para que un
 * reinicio en mitad del guardado no deje el token corrupto y obligue a
 * reautorizar.
 */
import fs from 'node:fs/promises';
import path from 'node:path';

const DATA_DIR = process.env.DATA_DIR || './data';
const FILE = path.join(DATA_DIR, 'kommo-tokens.json');

/** Copia en memoria: evita leer el disco en cada request. */
let cached;

export async function readTokens() {
  if (cached !== undefined) return cached;

  try {
    cached = JSON.parse(await fs.readFile(FILE, 'utf8'));
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
    cached = null; // todavía sin autorizar
  }
  return cached;
}

export async function writeTokens(tokens) {
  await fs.mkdir(DATA_DIR, { recursive: true });

  const tmp = FILE + '.' + process.pid + '.tmp';
  await fs.writeFile(tmp, JSON.stringify(tokens), { mode: 0o600 });
  await fs.rename(tmp, FILE);

  cached = tokens;
}

export function storePath() {
  return path.resolve(FILE);
}
