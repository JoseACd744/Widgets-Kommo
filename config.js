// Archivo de configuración para el widget
// Cambia SERVER_URL según tu entorno

const CONFIG = {
  // En desarrollo (local)
  // SERVER_URL: 'http://localhost:3000',
  
  // En producción - Railway
  SERVER_URL: 'https://servidor-calendar-widget-production.up.railway.app',
  
  // Configuración de Google Calendar
  GOOGLE_CLIENT_ID: '187937463238-45e5o4l80hn1tkpiftvahfs5pf2druj6.apps.googleusercontent.com',
  
  // Modo de autenticación: 'server' o 'direct'
  // 'server': usa el servidor backend (persistencia de sesión)
  // 'direct': autenticación directa con Google (sin persistencia)
  AUTH_MODE: 'server'
};

// Exportar configuración
if (typeof module !== 'undefined' && module.exports) {
  module.exports = CONFIG;
}
