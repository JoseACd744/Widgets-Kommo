/**
 * kommo-oauth-handler.js
 *
 * Handler para el flujo OAuth 2.0 de integraciones PÚBLICAS de Kommo.
 *
 * Documentación: https://developers.kommo.com/docs/authorization-public
 *
 * Flujo:
 *  1. El usuario instala el widget desde el Marketplace de Kommo.
 *  2. Kommo envía un GET al Redirect URL configurado en la integración:
 *       GET /oauth/kommo/callback?code=AUTH_CODE&referer=ACCOUNT_DOMAIN&from_widget=true
 *  3. Este handler recibe el GET, intercambia el code por access_token + refresh_token.
 *  4. Almacena los tokens asociados al account (referer) para hacer llamadas posteriores a la API.
 *
 * ─── INSTALACIÓN EN EL SERVIDOR (Railway / Node.js + Express) ───────────────
 *
 *  1. Copia este archivo al proyecto backend.
 *  2. Agrega las variables de entorno al servidor:
 *       KOMMO_CLIENT_ID     → Integration ID de la pestaña "Keys" en Kommo
 *       KOMMO_CLIENT_SECRET → Secret key de la pestaña "Keys" en Kommo
 *       KOMMO_REDIRECT_URI  → URL exacta del Redirect URL configurado en la integración
 *                             Ejemplo: https://tu-servidor.railway.app/oauth/kommo/callback
 *  3. Monta la ruta en tu app Express:
 *       const kommoOAuth = require('./kommo-oauth-handler');
 *       app.get('/oauth/kommo/callback', kommoOAuth.handleCallback);
 *       app.post('/oauth/kommo/refresh', kommoOAuth.refreshToken);
 *       app.get('/oauth/kommo/revoked', kommoOAuth.handleRevoked);
 *  4. Asegúrate de tener un método para persistir los tokens (base de datos / Redis).
 */

'use strict';

const https = require('https');

// ─── Configuración ──────────────────────────────────────────────────────────
const CLIENT_ID     = process.env.KOMMO_CLIENT_ID;
const CLIENT_SECRET = process.env.KOMMO_CLIENT_SECRET;
const REDIRECT_URI  = process.env.KOMMO_REDIRECT_URI;

// ─── Storage de tokens en memoria (reemplázalo por DB en producción) ─────────
// Estructura: { [accountDomain]: { access_token, refresh_token, expires_at } }
const tokenStore = {};

/**
 * Persiste los tokens de una cuenta.
 * Reemplaza esta función por tu lógica de base de datos en producción.
 */
async function saveTokens(accountDomain, tokens) {
  tokenStore[accountDomain] = {
    access_token:  tokens.access_token,
    refresh_token: tokens.refresh_token,
    token_type:    tokens.token_type,
    expires_at:    Date.now() + (tokens.expires_in * 1000),
    base_domain:   tokens.base_domain || accountDomain,
  };
  console.log('[KommoOAuth] Tokens guardados para:', accountDomain);
}

/**
 * Obtiene los tokens almacenados de una cuenta.
 */
async function getTokens(accountDomain) {
  return tokenStore[accountDomain] || null;
}

/**
 * Elimina los tokens de una cuenta (al desinstalar la integración).
 */
async function deleteTokens(accountDomain) {
  delete tokenStore[accountDomain];
  console.log('[KommoOAuth] Tokens eliminados para:', accountDomain);
}

// ─── Intercambio de código por tokens ────────────────────────────────────────

/**
 * Realiza el POST a la API de Kommo para intercambiar el authorization code
 * por access_token y refresh_token.
 *
 * @param {string} accountDomain - Dominio de la cuenta, ej: "miempresa.kommo.com"
 * @param {string} code          - Authorization code recibido en el webhook
 * @returns {Promise<Object>}    - Objeto con access_token, refresh_token, expires_in, etc.
 */
function exchangeCodeForTokens(accountDomain, code) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      client_id:     CLIENT_ID,
      client_secret: CLIENT_SECRET,
      grant_type:    'authorization_code',
      code:          code,
      redirect_uri:  REDIRECT_URI,
    });

    const options = {
      hostname: accountDomain,
      path:     '/oauth2/access_token',
      method:   'POST',
      headers: {
        'Content-Type':   'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (res.statusCode === 200) {
            resolve(parsed);
          } else {
            reject(new Error(`Kommo OAuth error ${res.statusCode}: ${data}`));
          }
        } catch (e) {
          reject(new Error('Respuesta inválida de Kommo: ' + data));
        }
      });
    });

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

/**
 * Renueva el access_token usando el refresh_token.
 *
 * @param {string} accountDomain - Dominio de la cuenta
 * @returns {Promise<Object>}    - Nuevos tokens
 */
async function doRefreshToken(accountDomain) {
  const stored = await getTokens(accountDomain);
  if (!stored || !stored.refresh_token) {
    throw new Error('No hay refresh_token almacenado para: ' + accountDomain);
  }

  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      client_id:     CLIENT_ID,
      client_secret: CLIENT_SECRET,
      grant_type:    'refresh_token',
      refresh_token: stored.refresh_token,
      redirect_uri:  REDIRECT_URI,
    });

    const options = {
      hostname: accountDomain,
      path:     '/oauth2/access_token',
      method:   'POST',
      headers: {
        'Content-Type':   'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', async () => {
        try {
          const parsed = JSON.parse(data);
          if (res.statusCode === 200) {
            await saveTokens(accountDomain, parsed);
            resolve(parsed);
          } else {
            reject(new Error(`Kommo refresh error ${res.statusCode}: ${data}`));
          }
        } catch (e) {
          reject(new Error('Respuesta inválida al renovar token: ' + data));
        }
      });
    });

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

/**
 * Devuelve un access_token válido para una cuenta.
 * Renueva automáticamente si está próximo a expirar (margen de 5 minutos).
 *
 * @param {string} accountDomain - Dominio de la cuenta
 * @returns {Promise<string>}    - access_token listo para usar
 */
async function getValidAccessToken(accountDomain) {
  const stored = await getTokens(accountDomain);
  if (!stored) {
    throw new Error('No hay tokens para la cuenta: ' + accountDomain);
  }

  const fiveMinutes = 5 * 60 * 1000;
  if (Date.now() >= stored.expires_at - fiveMinutes) {
    console.log('[KommoOAuth] Access token expirado, renovando...');
    const refreshed = await doRefreshToken(accountDomain);
    return refreshed.access_token;
  }

  return stored.access_token;
}

// ─── Express route handlers ───────────────────────────────────────────────────

/**
 * GET /oauth/kommo/callback
 *
 * Recibe el webhook de instalación del widget desde el Marketplace de Kommo.
 * Parámetros GET esperados:
 *   - code        : Authorization code
 *   - referer     : Dominio de la cuenta (ej: "miempresa.kommo.com")
 *   - from_widget : "true" si proviene de la instalación del widget
 *
 * Respuesta: redirige al usuario de vuelta a su cuenta de Kommo.
 */
async function handleCallback(req, res) {
  const { code, referer, from_widget } = req.query;

  if (!code || !referer) {
    console.error('[KommoOAuth] Callback sin code o referer');
    return res.status(400).send('Parámetros faltantes: code y referer son requeridos.');
  }

  try {
    console.log(`[KommoOAuth] Recibido callback: referer=${referer}, from_widget=${from_widget}`);

    // Intercambiar code por tokens
    const tokens = await exchangeCodeForTokens(referer, code);

    // Persistir tokens
    await saveTokens(referer, tokens);

    // Opcional: inicializar configuración del widget para esta cuenta
    // await initializeAccountConfig(referer, tokens);

    console.log(`[KommoOAuth] Autorización completada para: ${referer}`);

    // Redirigir al usuario de vuelta a su cuenta de Kommo
    // Kommo espera que el redirect lleve al usuario a algún lugar útil
    const redirectTo = `https://${referer}/settings/widgets/`;
    return res.redirect(302, redirectTo);

  } catch (error) {
    console.error('[KommoOAuth] Error en callback:', error.message);
    return res.status(500).send('Error durante la autorización. Por favor intenta de nuevo.');
  }
}

/**
 * POST /oauth/kommo/refresh
 *
 * Endpoint interno para renovar manualmente el access_token de una cuenta.
 * Body JSON esperado:
 *   { "accountDomain": "miempresa.kommo.com" }
 */
async function refreshToken(req, res) {
  const { accountDomain } = req.body;

  if (!accountDomain) {
    return res.status(400).json({ error: 'accountDomain requerido' });
  }

  try {
    const tokens = await doRefreshToken(accountDomain);
    return res.json({ success: true, expires_in: tokens.expires_in });
  } catch (error) {
    console.error('[KommoOAuth] Error al renovar token:', error.message);
    return res.status(500).json({ error: error.message });
  }
}

/**
 * GET /oauth/kommo/revoked
 *
 * Webhook de "Access Revoked" (campo opcional en la integración de Kommo).
 * Kommo envía un GET aquí cuando el usuario desinstala / revoca la integración.
 * Parámetros GET:
 *   - account_id : ID numérico de la cuenta
 *   - client_id  : Integration ID
 */
async function handleRevoked(req, res) {
  const { account_id, client_id } = req.query;

  console.log(`[KommoOAuth] Acceso revocado: account_id=${account_id}, client_id=${client_id}`);

  // Busca el dominio a partir del account_id si lo tienes en tu DB
  // Por ahora solo confirmamos recepción
  // await deleteTokensByAccountId(account_id);

  return res.status(200).send('OK');
}

// ─── Exports ──────────────────────────────────────────────────────────────────
module.exports = {
  handleCallback,
  refreshToken,
  handleRevoked,
  getValidAccessToken,
  saveTokens,
  getTokens,
  deleteTokens,
};
