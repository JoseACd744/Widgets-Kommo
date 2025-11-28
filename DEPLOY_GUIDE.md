# 🚀 Guía de Despliegue Rápido - Railway.app

La forma más fácil de desplegar tu servidor es usando Railway.app (gratis para empezar).

## Paso 1: Preparar Google Cloud Console

1. Ve a https://console.cloud.google.com/apis/credentials
2. Selecciona tu proyecto OAuth 2.0
3. En "URIs de redireccionamiento autorizados", agrega:
   ```
   https://TU-APP.up.railway.app/auth/google/callback
   ```
   (Reemplaza TU-APP con el nombre que Railway te asigne)

## Paso 2: Crear cuenta en Railway

1. Ve a https://railway.app
2. Haz clic en "Start a New Project"
3. Conecta tu cuenta de GitHub
4. Selecciona "Deploy from GitHub repo"

## Paso 3: Configurar el proyecto

1. Selecciona el repositorio `Widgets-Kommo`
2. Railway detectará automáticamente que es un proyecto Node.js
3. Configura el "Root Directory" como `/server`

## Paso 4: Configurar Variables de Entorno

En Railway, ve a la pestaña "Variables" y agrega:

```
GOOGLE_CLIENT_ID=187937463238-45e5o4l80hn1tkpiftvahfs5pf2druj6.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=tu_client_secret_de_google
GOOGLE_REDIRECT_URI=https://TU-APP.up.railway.app/auth/google/callback
SESSION_SECRET=genera_un_string_aleatorio_muy_seguro_aqui
ALLOWED_ORIGINS=https://tu-dominio.kommo.com
NODE_ENV=production
PORT=3000
```

### Generar SESSION_SECRET seguro:

En tu terminal local, ejecuta:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## Paso 5: Desplegar

1. Railway desplegará automáticamente
2. Espera 2-3 minutos
3. Railway te dará una URL como: `https://tu-app-nombre.up.railway.app`

## Paso 6: Actualizar widget

En `config.js` del widget, cambia:

```javascript
const CONFIG = {
  SERVER_URL: 'https://tu-app-nombre.up.railway.app',
  AUTH_MODE: 'server'
};
```

## Paso 7: Volver a Google Cloud Console

Ahora que conoces tu URL de Railway, actualiza en Google Cloud Console:

1. URIs de redireccionamiento autorizados:
   ```
   https://tu-app-nombre.up.railway.app/auth/google/callback
   ```

2. Orígenes autorizados de JavaScript (si es necesario):
   ```
   https://tu-dominio.kommo.com
   ```

## ✅ Verificar que funciona

1. Abre tu widget en Kommo
2. Haz clic en "Autorizar con Google"
3. Se abrirá una ventana de Google
4. Autoriza los permisos
5. La ventana se cerrará automáticamente
6. Deberías ver el formulario y tus calendarios

## 🔧 Troubleshooting

### Error: redirect_uri_mismatch
- Verifica que la URI en Google Cloud Console sea EXACTAMENTE igual a la de Railway
- No olvides el `/auth/google/callback` al final

### Error: CORS
- Verifica que `ALLOWED_ORIGINS` incluya tu dominio de Kommo
- Formato: `https://tudominio.kommo.com` (sin / al final)

### Error: No se cargan calendarios
- Verifica en Railway logs que el servidor esté corriendo
- En Railway, ve a "Deployments" → "View Logs"

### Sesiones no persisten
- Por defecto, Railway reinicia el contenedor y pierdes sesiones en memoria
- Solución: Agregar MongoDB (ver guía avanzada)

## 💰 Costos

Railway ofrece:
- **$5 gratis al mes** (suficiente para desarrollo/pruebas)
- Después: ~$5-10/mes según uso
- Alternativa gratuita: Heroku (con limitaciones)

## 📊 Monitoreo

En Railway puedes ver:
- Logs en tiempo real
- Uso de CPU/memoria
- Peticiones HTTP
- Errores

## 🔄 Actualizar código

1. Haz push a GitHub:
   ```bash
   git add .
   git commit -m "Update server"
   git push
   ```

2. Railway desplegará automáticamente

## 🚀 Siguiente nivel: Agregar MongoDB

Para persistencia de sesiones en producción:

1. En Railway, agrega un servicio "MongoDB"
2. Railway te dará una URL de conexión
3. Agrega variable de entorno:
   ```
   MONGODB_URI=mongodb://...url-de-railway...
   ```
4. El código ya está preparado para usar MongoDB automáticamente

---

## Alternativa: Heroku (Gratis con limitaciones)

Si prefieres Heroku:

```bash
cd server
heroku login
heroku create tu-app-nombre
heroku config:set GOOGLE_CLIENT_ID=...
heroku config:set GOOGLE_CLIENT_SECRET=...
# ... resto de variables
git push heroku main
```

---

¿Necesitas ayuda? Revisa los logs en Railway para ver errores específicos.
