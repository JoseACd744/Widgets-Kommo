# Proxy de historial de chat de Kommo

La sesión del navegador no tiene el scope `chat_history`, así que
`GET /api/v4/talks/{id}/messages` responde `403 Invalid scope` desde un widget.
Este servidor guarda el token OAuth de una **integración privada** que sí lo
tiene y expone la conversación ya normalizada.

```
widget (navegador)  ──X-Widget-Key──>  proxy  ──Bearer token──>  Kommo API v4
```

Node ≥ 20, sin dependencias (usa `node:http` y el `fetch` nativo). `npm install`
no instala nada, así que los despliegues son rápidos.

## Rutas

| Ruta | Uso |
|---|---|
| `GET /health` | Estado; dice si ya hay token y qué variables faltan. Es el healthcheck de Railway. Con `X-Widget-Key` agrega un bloque `config` para depurar. |
| `GET /oauth/callback?code=…` | Canjea el código de autorización. Se usa una sola vez. |
| `GET /export?lead_id=N` | Conversaciones + mensajes. Requiere `X-Widget-Key`. |

`/export` acepta además `from` y `to` (timestamps unix) para acotar por fecha.

---

## Despliegue en Railway

### 1. Crear el servicio

Desde el repo (Railway sirve el subdirectorio con **Root Directory**):

1. [railway.app](https://railway.app) → **New Project → Deploy from GitHub repo**
   → elegir este repositorio.
2. En el servicio → **Settings → Source → Root Directory**: `server-kommo-chat`.
3. **Settings → Networking → Generate Domain**. Anotá el dominio, del tipo
   `https://kommo-chat-proxy-production.up.railway.app`.

Con la CLI es equivalente:

```bash
npm i -g @railway/cli
railway login
cd server-kommo-chat
railway init
railway up
railway domain
```

### 2. Agregar el volumen (importante)

El token vive en un archivo. Sin volumen se pierde en cada redeploy y hay que
reautorizar a mano.

En el servicio → **Variables/Settings → + New Volume**, con **Mount path**
`/data`.

### 3. Crear la integración privada en Kommo

En Kommo: **Ajustes → Integraciones → Crear integración → Integración privada**.

- **Enlace de redirección (redirect_uri):**
  `https://TU-DOMINIO.up.railway.app/oauth/callback`
- **Permisos / scopes:** marcá **Historial de chat externo** (`chat_history`).
  Sin este scope el `403` se repite igual que con la sesión del navegador.

Guardá y abrí la pestaña **Claves y scopes**: ahí están `ID de integración`
(client_id), `Clave secreta` (client_secret) y un **código de autorización** que
caduca a los 20 minutos.

### 4. Cargar las variables

En Railway → **Variables**. `PORT` la inyecta Railway sola.

| Variable | Valor |
|---|---|
| `KOMMO_SUBDOMAIN` | `h0l0s` |
| `KOMMO_CLIENT_ID` | ID de integración |
| `KOMMO_CLIENT_SECRET` | Clave secreta |
| `KOMMO_REDIRECT_URI` | `https://TU-DOMINIO.up.railway.app/oauth/callback` (idéntico al de Kommo) |
| `WIDGET_KEY` | inventala; la misma va en el widget |
| `ALLOWED_ORIGINS` | `https://h0l0s.kommo.com` |
| `DATA_DIR` | `/data` (el mount path del volumen) |

Para generar una `WIDGET_KEY` razonable:

```bash
node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"
```

Verificá que no falte nada:

```bash
curl https://TU-DOMINIO.up.railway.app/health
# {"ok":true,"authorized":false,...,"missing_env":[]}
```

### 5. Autorizar (una sola vez)

Con el código de autorización todavía vigente, abrí en el navegador:

```
https://TU-DOMINIO.up.railway.app/oauth/callback?code=EL_CODIGO
```

Debe responder «Autorización guardada». Confirmá:

```bash
curl https://TU-DOMINIO.up.railway.app/health
# {"ok":true,"authorized":true,...}
```

Si el código caducó, regenerálo en **Claves y scopes** y repetí.

### 6. Probar el export

```bash
curl -H "X-Widget-Key: TU_WIDGET_KEY" \
  "https://TU-DOMINIO.up.railway.app/export?lead_id=EL_LEAD_ID"
```

---

## Desarrollo local

```bash
cp .env.example .env   # completar valores
node --env-file=.env src/index.js
```

Para autorizar en local, el `redirect_uri` registrado en Kommo tiene que
apuntar a una URL alcanzable. Lo más simple es autorizar una vez contra
Railway y copiar `/data/kommo-tokens.json` a `./data/`.

## Problemas frecuentes

### `oauth_failed` con `Cannot decrypt the authorization code`

Kommo no pudo descifrar el código con el `client_id`/`client_secret` recibidos.
En orden de probabilidad:

1. **El código ya se usó.** Es de un solo uso. Abrir la URL del callback dos
   veces —o que el navegador la precargue— quema el código. Generá uno nuevo en
   **Claves y scopes**.
2. **Caducó.** Dura 20 minutos.
3. **Credenciales con whitespace.** Pegar en el panel de Railway arrastra
   espacios o saltos de línea. El servidor ya hace `trim()`, pero conviene
   confirmarlo:

   ```bash
   curl -H "X-Widget-Key: TU_CLAVE" https://TU-DOMINIO.up.railway.app/health
   ```

   En el bloque `config`, `has_whitespace` debe ser `false` en todo y las
   longitudes coincidir con las credenciales de Kommo.
4. **El código es de otra integración**, distinta a la del `client_id` cargado.

El propio `/oauth/callback` imprime esta checklist cuando falla, así que
alcanza con leer lo que aparece en el navegador.

### `403 Invalid scope` al exportar

A la integración le falta el scope **Historial de chat externo**. Agregalo en
Kommo y repetí la autorización (paso 5): un cambio de scopes invalida el token.

### `401 bad_widget_key` desde el widget

La `WIDGET_KEY` del servidor y la clave cargada en los ajustes del widget no
coinciden. El bloque `config` de `/health` muestra su longitud y prefijo para
cotejar sin exponerla.

## Notas operativas

- **Una sola réplica.** El volumen de Railway se monta en una instancia; además
  el refresco de token se serializa con un candado en memoria. `railway.json`
  fija `numReplicas: 1`; no lo subas sin mover el token a Redis o Postgres.
- **Rotación de tokens.** El `access_token` dura 24 h y el `refresh_token` 3
  meses. Cada refresh invalida el anterior, por eso el par nuevo se persiste en
  la misma operación (escritura atómica: temporal + rename). Si el servicio
  queda más de 3 meses sin uso, el refresh_token caduca y hay que repetir el
  paso 5.
- **Superficie expuesta.** Solo GET. `/export` valida `X-Widget-Key` con
  comparación en tiempo constante y CORS está restringido a `ALLOWED_ORIGINS`.
  La clave viaja al navegador (inevitable en un widget), así que tratala como un
  token de lectura interno, no como un secreto fuerte.
- **Límites.** Hasta 250 mensajes por página y 40 páginas por conversación
  (10.000 mensajes). Ajustable en `MAX_PAGES` dentro de `src/kommo.js`.
- **Costo.** El servicio duerme sin tráfico en el plan gratuito; la primera
  carga tras un rato de inactividad puede tardar unos segundos.
