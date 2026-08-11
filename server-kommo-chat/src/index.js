/**
 * Servidor HTTP del proxy (Railway).
 *
 *   GET /health              → estado; dice si ya hay token guardado
 *   GET /oauth/callback?code → canjea el código de autorización (una sola vez)
 *   GET /export?lead_id=N    → conversaciones + mensajes; requiere X-Widget-Key
 */
import http from 'node:http';
import { timingSafeEqual } from 'node:crypto';

import { HttpError, authorize, exportLead, configDiagnostics } from './kommo.js';
import { readTokens, storePath } from './store.js';

const PORT = process.env.PORT || 3000;

const REQUIRED = [
  'KOMMO_SUBDOMAIN',
  'KOMMO_CLIENT_ID',
  'KOMMO_CLIENT_SECRET',
  'KOMMO_REDIRECT_URI',
  'WIDGET_KEY'
];

// ─── Helpers ────────────────────────────────────────────────────────────────

const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

function corsHeaders(req) {
  const origin = req.headers.origin;
  if (!origin || !allowedOrigins.includes(origin)) return {};

  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Widget-Key',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin'
  };
}

function sendJson(req, res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
    ...corsHeaders(req)
  });
  res.end(body);
}

function sendText(req, res, status, text) {
  res.writeHead(status, {
    'Content-Type': 'text/plain; charset=utf-8',
    'Cache-Control': 'no-store',
    ...corsHeaders(req)
  });
  res.end(text);
}

/** Comparación en tiempo constante, para no filtrar la clave por timing. */
function safeEqual(a, b) {
  const ab = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

function hasWidgetKey(req) {
  return safeEqual(
    (req.headers['x-widget-key'] || '').trim(),
    (process.env.WIDGET_KEY || '').trim()
  );
}

// ─── Rutas ──────────────────────────────────────────────────────────────────

async function handleHealth(req, res) {
  const tokens = await readTokens();
  const missing = REQUIRED.filter((k) => !process.env[k]);

  const body = {
    ok: missing.length === 0,
    authorized: !!tokens,
    subdomain: (process.env.KOMMO_SUBDOMAIN || '').trim() || null,
    token_expires_at: tokens ? tokens.expires_at : null,
    missing_env: missing,
    store: storePath()
  };

  // El detalle de configuración solo con la clave del widget: /health es público.
  if (hasWidgetKey(req)) body.config = configDiagnostics();

  sendJson(req, res, 200, body);
}

async function handleOAuthCallback(req, res, url) {
  const code = url.searchParams.get('code');
  if (!code) {
    sendText(req, res, 400, 'Falta el parámetro ?code=');
    return;
  }

  try {
    await authorize(code);
  } catch (err) {
    if (err instanceof HttpError && err.code === 'oauth_failed') {
      sendText(req, res, 400, oauthHelp(err.detail));
      return;
    }
    throw err;
  }

  sendText(req, res, 200,
    'Autorización guardada. El widget ya puede exportar conversaciones.\n' +
    'Podés cerrar esta pestaña.');
}

/** Traduce el rechazo de Kommo a algo accionable en el navegador. */
function oauthHelp(detail) {
  const lines = ['No se pudo canjear el código.', '', 'Respuesta de Kommo:', detail, ''];

  if (/cannot decrypt/i.test(detail)) {
    lines.push(
      'Kommo no pudo descifrar el código. Revisá, en orden:',
      '',
      '  1. El código es de UN SOLO USO y dura 20 minutos.',
      '     Si ya abriste esta URL antes, generá uno nuevo en',
      '     Ajustes → Integraciones → tu integración → Claves y scopes.',
      '',
      '  2. KOMMO_CLIENT_ID y KOMMO_CLIENT_SECRET deben ser los de ESA misma',
      '     integración, sin espacios ni saltos de línea al pegarlos.',
      '     Comprobalo con:',
      '       curl -H "X-Widget-Key: TU_CLAVE" .../health',
      '     y mirá el bloque "config": has_whitespace debe ser false y las',
      '     longitudes coincidir con las de Kommo.',
      '',
      '  3. KOMMO_SUBDOMAIN debe ser el de la cuenta que emitió el código.'
    );
  } else if (/redirect/i.test(detail)) {
    lines.push(
      'El redirect_uri no coincide. KOMMO_REDIRECT_URI tiene que ser idéntico',
      'al enlace de redirección registrado en la integración de Kommo,',
      'incluyendo https:// y sin barra final de más.'
    );
  }

  return lines.join('\n');
}

async function handleExport(req, res, url) {
  if (!hasWidgetKey(req)) {
    throw new HttpError(401, 'bad_widget_key', 'Clave del widget inválida');
  }

  const leadId = Number.parseInt(url.searchParams.get('lead_id'), 10);
  if (!Number.isInteger(leadId) || leadId < 1) {
    throw new HttpError(400, 'bad_lead_id', 'lead_id ausente o inválido');
  }

  const range = {
    from: Number.parseInt(url.searchParams.get('from'), 10) || 0,
    to: Number.parseInt(url.searchParams.get('to'), 10) || 0
  };

  sendJson(req, res, 200, await exportLead(leadId, range));
}

// ─── Servidor ───────────────────────────────────────────────────────────────

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://' + (req.headers.host || 'localhost'));

  if (req.method === 'OPTIONS') {
    res.writeHead(204, corsHeaders(req));
    res.end();
    return;
  }

  try {
    if (req.method !== 'GET') {
      throw new HttpError(405, 'method_not_allowed', 'Solo se admite GET');
    }

    if (url.pathname === '/health')         return await handleHealth(req, res);
    if (url.pathname === '/oauth/callback') return await handleOAuthCallback(req, res, url);
    if (url.pathname === '/export')         return await handleExport(req, res, url);

    sendJson(req, res, 404, { error: 'not_found' });
  } catch (err) {
    if (err instanceof HttpError) {
      sendJson(req, res, err.status, { error: err.code, detail: err.detail });
      return;
    }
    console.error('[proxy] error inesperado:', err);
    sendJson(req, res, 500, { error: 'internal_error', detail: String(err?.message) });
  }
});

server.listen(PORT, '0.0.0.0', () => {
  const missing = REQUIRED.filter((k) => !process.env[k]);
  console.log(`[proxy] escuchando en :${PORT}`);
  console.log(`[proxy] tokens en ${storePath()}`);
  if (missing.length) {
    console.warn('[proxy] FALTAN variables de entorno:', missing.join(', '));
  }
});

// Railway envía SIGTERM en cada redeploy.
for (const sig of ['SIGTERM', 'SIGINT']) {
  process.on(sig, () => {
    console.log('[proxy] cerrando…');
    server.close(() => process.exit(0));
  });
}
