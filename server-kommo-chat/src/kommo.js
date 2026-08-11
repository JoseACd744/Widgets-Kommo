/**
 * Cliente de la API de Kommo: OAuth + lectura de conversaciones.
 *
 * El widget no puede llamar /api/v4/talks/{id}/messages directamente porque la
 * sesión del navegador no tiene el scope `chat_history` (Kommo responde
 * 403 "Invalid scope"). Este módulo usa el token de una integración privada que
 * sí lo tiene.
 */
import { readTokens, writeTokens } from './store.js';

const MAX_PAGES = 40;    // tope de seguridad: 40 * 250 = 10.000 mensajes por talk
const PAGE_LIMIT = 250;  // máximo que admite la API de Kommo

export class HttpError extends Error {
  constructor(status, code, detail) {
    super(code);
    this.status = status;
    this.code = code;
    this.detail = detail;
  }
}

/**
 * Lee una variable de entorno sin espacios ni saltos de línea alrededor.
 * Pegar credenciales en el panel de Railway arrastra whitespace con facilidad, y
 * Kommo responde "Cannot decrypt the authorization code" sin decir por qué.
 */
function env(name) {
  const v = process.env[name];
  return v === undefined ? undefined : v.trim();
}

function baseUrl() {
  return 'https://' + env('KOMMO_SUBDOMAIN') + '.kommo.com';
}

// ─── OAuth ──────────────────────────────────────────────────────────────────

async function exchange(params) {
  const res = await fetch(baseUrl() + '/oauth2/access_token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: env('KOMMO_CLIENT_ID'),
      client_secret: env('KOMMO_CLIENT_SECRET'),
      redirect_uri: env('KOMMO_REDIRECT_URI'),
      ...params
    })
  });

  const body = await res.text();
  if (!res.ok) throw new HttpError(502, 'oauth_failed', body.slice(0, 500));

  const data = JSON.parse(body);
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    // expires_in viene en segundos (86400). Se resta un margen de 5 minutos.
    expires_at: Date.now() + data.expires_in * 1000 - 300000
  };
}

/** Canjea el código de autorización inicial. Se usa una sola vez. */
export async function authorize(code) {
  const tokens = await exchange({ grant_type: 'authorization_code', code: code.trim() });
  await writeTokens(tokens);
  return tokens;
}

/**
 * Radiografía de la configuración para depurar el canje del código.
 * No devuelve los secretos: solo longitud, si traen whitespace y un prefijo
 * corto que alcanza para cotejarlos contra los de Kommo.
 */
export function configDiagnostics() {
  const check = (name, reveal) => {
    const raw = process.env[name];
    if (raw === undefined) return { set: false };
    return {
      set: true,
      length: raw.trim().length,
      has_whitespace: raw !== raw.trim(),
      value: reveal ? raw.trim() : raw.trim().slice(0, 8) + '…'
    };
  };

  return {
    KOMMO_SUBDOMAIN: check('KOMMO_SUBDOMAIN', true),
    KOMMO_CLIENT_ID: check('KOMMO_CLIENT_ID', false),
    KOMMO_CLIENT_SECRET: check('KOMMO_CLIENT_SECRET', false),
    KOMMO_REDIRECT_URI: check('KOMMO_REDIRECT_URI', true),
    WIDGET_KEY: check('WIDGET_KEY', false),
    ALLOWED_ORIGINS: check('ALLOWED_ORIGINS', true),
    token_endpoint: baseUrl() + '/oauth2/access_token'
  };
}

/**
 * Refresco en curso, compartido entre requests concurrentes.
 * Cada refresh invalida el refresh_token anterior, así que dos refrescos en
 * paralelo dejarían el guardado inservible. Con una sola instancia esta
 * promesa alcanza para serializarlos.
 */
let refreshing = null;

export async function accessToken() {
  const tokens = await readTokens();
  if (!tokens) {
    throw new HttpError(503, 'not_authorized', 'Falta completar el paso de OAuth (/oauth/callback?code=...)');
  }
  if (Date.now() < tokens.expires_at) return tokens.access_token;

  if (!refreshing) {
    refreshing = (async () => {
      const fresh = await exchange({
        grant_type: 'refresh_token',
        refresh_token: tokens.refresh_token
      });
      await writeTokens(fresh);
      return fresh.access_token;
    })().finally(() => { refreshing = null; });
  }
  return refreshing;
}

// ─── API v4 ─────────────────────────────────────────────────────────────────

async function apiGet(path) {
  const token = await accessToken();
  const res = await fetch(baseUrl() + path, {
    headers: {
      Authorization: 'Bearer ' + token,
      'Content-Type': 'application/json'
    }
  });

  if (res.status === 204) return null; // sin resultados
  if (!res.ok) {
    throw new HttpError(res.status, 'kommo_api_error', (await res.text()).slice(0, 500));
  }
  return res.json();
}

function normalizeMessage(m) {
  return {
    id: m.id,
    chat_id: m.chat_id ?? null,
    direction: m.type || '',                  // incoming | outgoing
    message_type: m.message_type || 'text',   // text | picture | file | voice | ...
    author: m.author?.name || '',
    author_type: m.author?.type || '',
    recipient: m.recipient?.name || '',
    text: m.text || '',
    created_at: m.created_at || 0,
    origin: m.origin || '',
    delivery_status: m.delivery_status ?? null,
    attachment: m.attachment
      ? {
          type: m.attachment.type || '',
          link: m.attachment.link || '',
          file_name: m.attachment.file_name || ''
        }
      : null
  };
}

/** Recorre todas las páginas de mensajes de una conversación. */
async function fetchAllMessages(talkId, range) {
  const messages = [];

  for (let page = 1; page <= MAX_PAGES; page++) {
    let path = `/api/v4/talks/${talkId}/messages?limit=${PAGE_LIMIT}&page=${page}`;
    if (range.from) path += '&filter[created_at][from]=' + range.from;
    if (range.to)   path += '&filter[created_at][to]=' + range.to;

    const data = await apiGet(path);
    const batch = data?._embedded?.messages || [];

    for (const m of batch) messages.push(normalizeMessage(m));
    if (batch.length < PAGE_LIMIT) break;
  }

  messages.sort((a, b) => a.created_at - b.created_at);
  return messages;
}

/** Conversaciones de un lead con todos sus mensajes, listo para el widget. */
export async function exportLead(leadId, range) {
  const talksData = await apiGet(
    `/api/v4/talks?filter[entity_type]=lead&filter[entity_id][]=${leadId}&limit=${PAGE_LIMIT}`
  );
  const talks = talksData?._embedded?.talks || [];

  const conversations = [];
  let total = 0;

  for (const talk of talks) {
    const messages = await fetchAllMessages(talk.talk_id, range);
    total += messages.length;

    conversations.push({
      talk_id: talk.talk_id,
      contact_id: talk.contact_id ?? null,
      created_at: talk.created_at || 0,
      updated_at: talk.updated_at || 0,
      origin: talk.origin || '',
      status: talk.status || '',
      is_in_work: !!talk.is_in_work,
      messages
    });
  }

  conversations.sort((a, b) => a.created_at - b.created_at);

  return {
    lead_id: leadId,
    exported_at: Math.floor(Date.now() / 1000),
    talks_count: conversations.length,
    messages_count: total,
    conversations
  };
}
