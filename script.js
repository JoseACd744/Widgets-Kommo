define(['jquery'], function ($) {
  var CustomWidget = function () {
    var self = this;
    let tokenClient;
    let gapiInited = false;
    let gisInited = false;

    // Configuración del servidor backend
    const SERVER_URL = 'https://servidor-calendar-widget-production.up.railway.app';
    let kommoUserId = null;
    let isAuthenticated = false;

    // FUNCIÓN PARA EJECUTAR SALESBOT
    function launchSalesbot(idBot, idLead) {
      const botLaunch = JSON.stringify([{ bot_id: idBot, entity_type: 2, entity_id: idLead }]);
      $.ajax({
        url: '/api/v2/salesbot/run',
        method: 'POST',
        contentType: 'application/json',
        data: botLaunch,
        success: function(data) {
          console.log('Respuesta del bot:', data);
        },
        error: function(xhr, status, error) {
          console.error('Error al ejecutar el bot:', status, error, xhr.responseText);
        }
      });
    }

    // Función para mostrar snackbars
    this.showSnackbar = function(message, type = 'info', duration = 3000) {
      // Eliminar snackbar anterior si existe
      const existingSnackbar = document.getElementById('snackbar');
      if (existingSnackbar) {
        existingSnackbar.remove();
      }

      // Crear nuevo snackbar
      const snackbar = document.createElement('div');
      snackbar.id = 'snackbar';
      snackbar.className = `snackbar ${type}`;
      snackbar.textContent = message;

      // Agregar al body
      document.body.appendChild(snackbar);

      // Mostrar snackbar
      setTimeout(() => {
        snackbar.classList.add('show');
      }, 100);

      // Ocultar y eliminar snackbar después del tiempo especificado
      setTimeout(() => {
        snackbar.classList.remove('show');
        setTimeout(() => {
          if (snackbar.parentNode) {
            snackbar.parentNode.removeChild(snackbar);
          }
        }, 600);
      }, duration);
    };

    // Función para cargar configuración desde el servidor
    this.loadConfigFromServer = async function() {
      if (!kommoUserId) {
        console.warn('⚠️ [CONFIG] No hay userId disponible');
        return null;
      }
      
      try {
        console.log('📥 [CONFIG] Cargando configuración desde servidor para usuario:', kommoUserId);
        const response = await fetch(`${SERVER_URL}/api/widget/config?userId=${kommoUserId}`, {
          credentials: 'include'
        });
        
        if (!response.ok) {
          if (response.status === 404) {
            console.log('📥 [CONFIG] No hay configuración guardada en servidor');
            return null;
          }
          throw new Error('Error cargando configuración');
        }
        
        const data = await response.json();
        console.log('✅ [CONFIG] Configuración cargada desde servidor:', data);
        return data.config || data;
        
      } catch (error) {
        console.warn('⚠️ [CONFIG] Error cargando desde servidor:', error.message);
        return null;
      }
    };

    this.callbacks = {
      settings: function () {
        // Implementar lógica para campo custom en settings
        console.log('⚙️ [SETTINGS_CALLBACK] Inicializando campo custom...');
        console.log('⚙️ [SETTINGS_CALLBACK] self.get_settings():', self.get_settings());
        console.log('⚙️ [SETTINGS_CALLBACK] self.system():', self.system());
        
        // Obtener account ID en contexto de settings (si no se obtuvo en init)
        if (!kommoUserId) {
          try {
            if (typeof APP !== 'undefined' && APP.constant && APP.constant('account')) {
              kommoUserId = APP.constant('account').id;
              console.log('⚙️ [SETTINGS_CALLBACK] Kommo Account ID desde APP:', kommoUserId);
            } else if (typeof AMOCRM !== 'undefined' && AMOCRM.constant && AMOCRM.constant('account')) {
              kommoUserId = AMOCRM.constant('account').id;
              console.log('⚙️ [SETTINGS_CALLBACK] Kommo Account ID desde AMOCRM:', kommoUserId);
            } else {
              kommoUserId = 'default-user';
              console.log('⚠️ [SETTINGS_CALLBACK] No se pudo obtener account ID, usando default');
            }
          } catch (e) {
            console.error('❌ [SETTINGS_CALLBACK] Error obteniendo account ID:', e);
            kommoUserId = 'default-user';
          }
        }
        
        setTimeout(function() {
          // Obtener código del widget desde las settings
          const widgetSettings = self.get_settings();
          console.log('⚙️ [SETTINGS_CALLBACK] widgetSettings completo:', JSON.stringify(widgetSettings, null, 2));
          
          const widgetCode = widgetSettings.widget_code || 'google_calendar';
          console.log('⚙️ [SETTINGS_CALLBACK] widgetCode:', widgetCode);
          
          // ID del div donde inyectaremos nuestra interfaz
          const customContentId = `${widgetCode}_custom_content`;
          const customInputId = `${widgetCode}_custom`;
          
          console.log('⚙️ [SETTINGS_CALLBACK] Custom content ID:', customContentId);
          console.log('⚙️ [SETTINGS_CALLBACK] Custom input ID:', customInputId);
          
          // Verificar si existen los elementos en el DOM
          const contentElement = document.getElementById(customContentId);
          const inputElement = document.getElementById(customInputId);
          
          console.log('⚙️ [SETTINGS_CALLBACK] Content element existe?:', !!contentElement, contentElement);
          console.log('⚙️ [SETTINGS_CALLBACK] Input element existe?:', !!inputElement, inputElement);
          
          // Listar todos los divs que tienen "custom" en el ID
          const allDivs = document.querySelectorAll('div[id*="custom"]');
          console.log('⚙️ [SETTINGS_CALLBACK] Divs con "custom" en ID:', allDivs.length);
          allDivs.forEach(div => {
            console.log('  - Div encontrado:', div.id, div);
          });
          
          // Listar todos los inputs que tienen "custom" en el ID o name
          const allInputs = document.querySelectorAll('input[id*="custom"], input[name*="custom"]');
          console.log('⚙️ [SETTINGS_CALLBACK] Inputs con "custom" en ID/name:', allInputs.length);
          allInputs.forEach(input => {
            console.log('  - Input encontrado:', input.id, input.name, input);
          });
          
          // Construir interfaz personalizada
          self.buildCustomSettingsUI(customContentId, customInputId);
        }, 500);
        
        return true;
      },
      init: function () {
        console.log('🔵 [INIT] Widget inicializando...');
        
        // Obtener ID de la cuenta de Kommo (consistente en todos los contextos)
        try {
          if (typeof APP !== 'undefined' && APP.constant && APP.constant('account')) {
            kommoUserId = APP.constant('account').id;
            console.log('🔵 [INIT] Kommo Account ID:', kommoUserId);
          } else if (typeof AMOCRM !== 'undefined' && AMOCRM.constant && AMOCRM.constant('account')) {
            kommoUserId = AMOCRM.constant('account').id;
            console.log('🔵 [INIT] Kommo Account ID (AMOCRM):', kommoUserId);
          } else {
            kommoUserId = 'default-user';
            console.log('⚠️ [INIT] No se pudo obtener el account ID, usando default-user');
          }
        } catch (e) {
          console.error('❌ [INIT] Error obteniendo account ID de Kommo:', e);
          kommoUserId = 'default-user';
        }
        
        console.log('🔵 [INIT] Account ID final establecido:', kommoUserId);
        
        // Verificar sesión de forma silenciosa (sin manipular DOM)
        // Esto solo actualiza la variable isAuthenticated para uso posterior
        console.log('🔵 [INIT] Verificando sesión silenciosamente...');
        self.checkExistingSession().then(function(authenticated) {
          console.log('🔵 [INIT] Estado de autenticación:', authenticated);
        }).catch(function(error) {
          console.warn('⚠️ [INIT] Error en verificación de sesión:', error);
        });
        
        self.loadCSS();
        
        // Agregar fuente personalizada en el control de envío
        self.add_source('custom', function($el) {
          console.log('📝 [SOURCE] Inicializando fuente de agendamiento...');
          self.renderSubmissionControl($el);
        }, '📅 Agendar Reunión');
        
        return true;
      },
      bind_actions: function () {
        $(document).off('click', '#authorize_button').on('click', '#authorize_button', function () {
          self.authorizeGoogle();
        });

        $(document).off('click', '#signout_button').on('click', '#signout_button', function () {
          self.signOutGoogle();
        });

        $(document).off('submit', '#reunionForm').on('submit', '#reunionForm', function (e) {
          self.createEvent(e);
        });
        
        // Botón de guardar configuración en settings
        $(document).off('click', '#save_field_mapping').on('click', '#save_field_mapping', function () {
          self.saveFieldMapping();
        });

        // Evento para actualizar automáticamente la hora de fin
        $(document).off('input', '#hora_inicio').on('input', '#hora_inicio', function () {
          const horaInicio = $(this).val();
          if (horaInicio) {
            const [hours, minutes] = horaInicio.split(':').map(Number);
            const date = new Date();
            date.setHours(hours, minutes + 30); // Sumar 30 minutos
            const horaFin = date.toTimeString().slice(0, 5); // Formato HH:MM
            $('#hora_fin').val(horaFin);
          }
        });

        return true;
      },

      render: function () {
        // Detectar en qué ubicación estamos
        const currentArea = self.system().area;
        console.log('🎯 [RENDER] Área actual:', currentArea);
        
        if (currentArea === 'settings') {
          // En settings NO usamos render_template, la UI se inyecta en el campo custom
          // desde el callback settings()
          console.log('🎯 [RENDER] En settings - NO renderizar template, usar campo custom');
          return true;
        } else {
          // En otras áreas (lcard, ccard, comcard) renderizamos normalmente
          self.renderTemplate();
        }
        return true;
      },
      onSave: function () {
        return true;
      },
      leads: {
        selected: function () {
          return true;
        }
      },
      destroy: function () {}
    };

    // Cargar CSS para el widget y los botones
    this.loadCSS = function() {
      var settings = self.get_settings();
      if ($('link[href="' + settings.path + '/style.css?v=' + settings.version + '"]').length < 1) {
        $('head').append('<link href="' + settings.path + '/style.css?v=' + settings.version + '" rel="stylesheet">');
      }
      $('head').append('<link href="https://cdn.jsdelivr.net/npm/fullcalendar@6.1.8/main.min.css" rel="stylesheet">');

      // Agregar estilos personalizados directamente
      const styles = `
        .km-google-calendar-widget {
          font-family: Arial, sans-serif;
          max-width: 400px;
          margin: 20px auto;
          padding: 33px;
          border: 1px solid #ddd;
          border-radius: 8px;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }
        .km-google-calendar-widget h1 {
          font-size: 20px;
          margin-bottom: 20px;
          text-align: center;
          color: #333;
        }
        .km-google-calendar-widget button {
          display: block;
          width: 100%;
          padding: 10px;
          margin: 10px 0;
          font-size: 16px;
          color: #fff;
          background-color: #007bff;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          transition: background-color 0.3s ease;
        }
        .km-google-calendar-widget button:hover {
          background-color: #0056b3;
        }
        .km-google-calendar-widget button#signout_button {
          background-color: #dc3545;
        }
        .km-google-calendar-widget button#signout_button:hover {
          background-color: #a71d2a;
        }
        .km-google-calendar-widget form {
          margin-top: 10px;
        }
        .km-google-calendar-widget label {
          display: block;
          margin-bottom: 5px;
          font-weight: bold;
          color: #555;
        }
        .km-google-calendar-widget input,
        .km-google-calendar-widget select {
          width: 94%;
          padding: 6px;
          border: 1px solid #ccc;
          border-radius: 4px;
          font-size: 14px;
        }
        .km-google-calendar-widget input:focus,
        .km-google-calendar-widget select:focus {
          border-color: #007bff;
          outline: none;
          box-shadow: 0 0 4px rgba(0, 123, 255, 0.5);
        }
        .km-google-calendar-widget button[type="submit"] {
          background-color: #28a745;
        }
        .km-google-calendar-widget button[type="submit"]:hover {
          background-color: #218838;
        }

        /* Estilos para Snackbar */
        .snackbar {
          visibility: hidden;
          min-width: 250px;
          margin-left: -125px;
          background-color: #333;
          color: white;
          text-align: center;
          border-radius: 8px;
          padding: 16px;
          position: fixed;
          z-index: 1000;
          left: 50%;
          bottom: 30px;
          font-size: 16px;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3);
          opacity: 0;
          transition: opacity 0.6s, visibility 0.6s;
        }

        .snackbar.show {
          visibility: visible;
          opacity: 1;
        }

        .snackbar.success {
          background-color: #4caf50;
        }

        .snackbar.error {
          background-color: #f44336;
        }

        .snackbar.warning {
          background-color: #ff9800;
        }

        .snackbar.info {
          background-color: #2196f3;
        }
      `;
      $('head').append('<style>' + styles + '</style>');

      // Cargar Google API
      $.getScript('https://apis.google.com/js/api.js', function() {
        self.gapiLoaded();
      });

      // Cargar Google OAuth
      $.getScript('https://accounts.google.com/gsi/client', function() {
        self.gisLoaded();
      });
    };

    // ========================================
    // FUNCIONES PARA INTERACTUAR CON EL SERVIDOR
    // ========================================

    // Verificar si ya hay una sesión activa en el servidor
    this.checkExistingSession = async function() {
      console.log('🟡 [CHECK_SESSION] Iniciando verificación de sesión...');
      console.log('🟡 [CHECK_SESSION] SERVER_URL:', SERVER_URL);
      console.log('🟡 [CHECK_SESSION] Usuario Kommo:', kommoUserId);
      
      // Verificar localStorage primero (fallback para cookies cross-origin)
      const localAuth = localStorage.getItem(`google_auth_${kommoUserId}`);
      const authTimestamp = localStorage.getItem(`google_auth_timestamp_${kommoUserId}`);
      const sevenDays = 7 * 24 * 60 * 60 * 1000; // 7 días en ms
      
      if (localAuth === 'true' && authTimestamp) {
        const isExpired = (Date.now() - parseInt(authTimestamp)) > sevenDays;
        console.log('💾 [CHECK_SESSION] localStorage auth:', localAuth, '- Expirado:', isExpired);
        
        if (!isExpired) {
          console.log('✅ [CHECK_SESSION] Sesión válida en localStorage');
          isAuthenticated = true;
          
          // NO intentar manipular el DOM aquí - se hará en renderTemplate
          // Solo marcar como autenticado
          return true;
        } else {
          console.log('⏰ [CHECK_SESSION] Sesión expirada en localStorage - limpiando');
          localStorage.removeItem(`google_auth_${kommoUserId}`);
          localStorage.removeItem(`google_auth_timestamp_${kommoUserId}`);
        }
      }
      
      // Si no hay localStorage válido, verificar con el servidor
      try {
        const url = `${SERVER_URL}/auth/status?userId=${kommoUserId}`;
        console.log('🟡 [CHECK_SESSION] Llamando a:', url);
        
        const response = await fetch(url, {
          credentials: 'include'
        });
        
        console.log('🟡 [CHECK_SESSION] Response status:', response.status);
        
        const data = await response.json();
        console.log('🟡 [CHECK_SESSION] Response data:', JSON.stringify(data, null, 2));
        
        if (data.authenticated) {
          console.log('✅ [CHECK_SESSION] Usuario autenticado!');
          isAuthenticated = true;
          return true;
        } else {
          console.log('ℹ️ [CHECK_SESSION] No hay sesión activa');
          isAuthenticated = false;
          return false;
        }
      } catch (error) {
        console.error('❌ [CHECK_SESSION] Error verificando sesión:', error);
        isAuthenticated = false;
        return false;
      }
    };

    // Cargar calendarios desde el servidor
    this.loadCalendarsFromServer = async function() {
      console.log('📅 [CALENDARS] Cargando calendarios para usuario:', kommoUserId);
      try {
        const response = await fetch(`${SERVER_URL}/api/calendars?userId=${kommoUserId}`, {
          credentials: 'include'
        });
        
        console.log('📅 [CALENDARS] Response status:', response.status);
        
        if (!response.ok) {
          throw new Error('Error obteniendo calendarios');
        }
        
        const calendars = await response.json();
        console.log('📅 [CALENDARS] Calendarios recibidos:', calendars.length);
        
        if (!calendars || calendars.length === 0) {
          self.showSnackbar('No se encontraron calendarios', 'warning');
          self.loadStaticCalendars();
          return;
        }
        
        const dropdown = document.getElementById("calendar_dropdown");
        
        // Verificar que el dropdown existe antes de usarlo
        if (!dropdown) {
          console.warn('⚠️ [CALENDARS] Dropdown no existe aún en el DOM, guardando calendarios para después');
          // Guardar calendarios para cuando el DOM esté listo
          window.pendingCalendars = calendars;
          return;
        }
        
        dropdown.innerHTML = '<option value="" disabled selected>Seleccione un calendario</option>';
        
        calendars.forEach((calendar) => {
          const option = document.createElement("option");
          option.value = calendar.id;
          option.textContent = calendar.summary;
          
          if (calendar.primary || calendar.id === 'primary') {
            option.selected = true;
          }
          
          dropdown.appendChild(option);
        });
        
        console.log(`✅ ${calendars.length} calendarios cargados desde el servidor`);
        
      } catch (error) {
        console.error('❌ [CALENDARS] Error cargando calendarios desde servidor:', error);
        console.error('❌ [CALENDARS] Error details:', error.message);
        self.showSnackbar('Usando calendarios por defecto', 'info', 2000);
        self.loadStaticCalendars();
      }
    };

    // Función auxiliar para llamadas fetch con manejo de errores
    async function serverFetch(url, options = {}) {
      const defaultOptions = {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...options.headers
        },
        ...options
      };
      
      const response = await fetch(`${SERVER_URL}${url}`, defaultOptions);
      
      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Error desconocido' }));
        throw new Error(error.error || `HTTP ${response.status}`);
      }
      
      return response.json();
    }

    // Cargar lista estática de calendarios (fallback)
    this.loadCalendars = async function() {
      try {
        // Verificar que gapi esté inicializado y autorizado
        if (!gapi.client || !gapi.client.getToken()) {
          console.warn('Usuario no autorizado, usando calendarios estáticos');
          self.loadStaticCalendars();
          return;
        }

        // Obtener lista de calendarios de Google Calendar API
        const response = await gapi.client.calendar.calendarList.list();
        const calendars = response.result.items;

        if (!calendars || calendars.length === 0) {
          self.showSnackbar('No se encontraron calendarios', 'warning');
          self.loadStaticCalendars();
          return;
        }

        // Generar opciones para el dropdown
        const dropdown = document.getElementById("calendar_dropdown");
        dropdown.innerHTML = '<option value="" disabled selected>Seleccione un calendario</option>';
        
        calendars.forEach((calendar) => {
          const option = document.createElement("option");
          option.value = calendar.id;
          option.textContent = calendar.summary;

          // Seleccionar por defecto el calendario "primary"
          if (calendar.id === 'primary' || calendar.primary) {
            option.selected = true;
          }

          dropdown.appendChild(option);
        });
        
        console.log(`${calendars.length} calendarios cargados exitosamente`);
        self.showSnackbar('Calendarios cargados exitosamente', 'success', 2000);
      } catch (error) {
        console.error('Error cargando calendarios desde Google API:', error);
        self.showSnackbar('Error cargando calendarios, usando lista por defecto', 'warning');
        
        // Fallback a lista estática en caso de error
        self.loadStaticCalendars();
      }
    };

    // Función fallback con lista estática de calendarios
    this.loadStaticCalendars = function() {
      const calendars = [
        { id: 'primary', summary: 'Holos Digital Partners | Ventas' },
        { id: 'c_586d8a87e53fe35bd3fb3e8a998a456f2db0a195f4192c2275a79662ddf70165@group.calendar.google.com', summary: 'Kommo, by Holos' },
        { id: 'c_462b71c22d24f69ce52edb36254bdd7ab97848aceaea241e01df359762bcfafa@group.calendar.google.com', summary: 'tldv meetings' },
        { id: 'c_5afd7289c6145e02223863817b7b2e5ccfb0742b56c66cbc8661b712583c5561@group.calendar.google.com', summary: 'Demo Kommo USA - Calendly' },
        { id: 'c_ba21c2fb63feda18d531228728292bcb4898d94b260ca4325679596fa2208d84@group.calendar.google.com', summary: 'Demo Kommo EC' }
      ];

      const dropdown = document.getElementById("calendar_dropdown");
      
      // Verificar que el dropdown existe antes de usarlo
      if (!dropdown) {
        console.warn('⚠️ [STATIC_CALENDARS] Dropdown no existe aún en el DOM, guardando calendarios para después');
        // Guardar calendarios para cuando el DOM esté listo
        window.pendingCalendars = calendars;
        return;
      }
      
      dropdown.innerHTML = '<option value="" disabled selected>Seleccione un calendario</option>';
      
      calendars.forEach((calendar) => {
        const option = document.createElement("option");
        option.value = calendar.id;
        option.textContent = calendar.summary;

        if (calendar.id === 'primary') {
          option.selected = true;
        }

        dropdown.appendChild(option);
      });
    };

    // ========================================
    // FUNCIONES GAPI/GIS (YA NO SE USAN - El servidor maneja OAuth)
    // Mantenidas por compatibilidad, pero el widget usa el servidor
    // ========================================

    // Inicializar Google API (no se usa con servidor)
    this.gapiLoaded = function() {
      // Ya no es necesario - el servidor maneja la autenticación
      console.log('GAPI no es necesario - usando servidor backend');
    };

    this.initializeGapiClient = async function() {
      // Ya no es necesario - el servidor maneja la autenticación
      console.log('GAPI Client no es necesario - usando servidor backend');
    };

    // Inicializar Google OAuth (no se usa con servidor)
    this.gisLoaded = function() {
      // Ya no es necesario - el servidor maneja la autenticación
      console.log('GIS no es necesario - usando servidor backend');
    };

    // Función de autorización de Google (usando servidor)
    this.authorizeGoogle = async function() {
      console.log('🔐 [AUTH] Iniciando autorización de Google...');
      console.log('🔐 [AUTH] Usuario Kommo:', kommoUserId);
      
      try {
        self.showSnackbar('Conectando con Google...', 'info', 2000);
        
        // Obtener URL de autorización del servidor
        const url = `/auth/google/url?userId=${kommoUserId}`;
        console.log('🔐 [AUTH] Solicitando URL de auth:', url);
        
        const data = await serverFetch(url);
        console.log('🔐 [AUTH] Respuesta del servidor:', data);
        
        if (!data.authUrl) {
          throw new Error('No se pudo obtener la URL de autorización');
        }
        
        // Abrir ventana emergente para autorización
        const width = 600;
        const height = 700;
        const left = (screen.width - width) / 2;
        const top = (screen.height - height) / 2;
        
        console.log('🔐 [AUTH] Abriendo ventana popup...');
        window.open(
          data.authUrl,
          'Google Authorization',
          `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`
        );
        
      } catch (error) {
        console.error('❌ [AUTH] Error en autorización:', error);
        self.showSnackbar('Error conectando con el servidor: ' + error.message, 'error');
      }
    };

    // Función de cierre de sesión (usando servidor)
    this.signOutGoogle = async function() {
      console.log('🔓 [SIGNOUT] Cerrando sesión para usuario:', kommoUserId);
      try {
        // Enviar userId en el body según la documentación de la API
        await serverFetch('/auth/logout', { 
          method: 'POST',
          body: JSON.stringify({
            userId: kommoUserId
          })
        });
        
        console.log('✅ [SIGNOUT] Sesión cerrada en el servidor');
        
        // Limpiar localStorage
        localStorage.removeItem(`google_auth_${kommoUserId}`);
        localStorage.removeItem(`google_auth_timestamp_${kommoUserId}`);
        console.log('💾 [SIGNOUT] localStorage limpiado');
        
        isAuthenticated = false;
        document.getElementById("formulario").style.display = "none";
        $('#authorize_button').show();
        $('#signout_button').hide();
        
        // Limpiar el dropdown de calendarios
        const dropdown = document.getElementById("calendar_dropdown");
        if (dropdown) {
          dropdown.innerHTML = '<option value="" disabled selected>Seleccione un calendario</option>';
        }
        
        self.showSnackbar('Sesión cerrada exitosamente', 'info');
      } catch (error) {
        console.error('Error cerrando sesión:', error);
        self.showSnackbar('Error al cerrar sesión', 'error');
      }
    };

    // Crear un evento en el calendario seleccionado (usando servidor)
    this.createEvent = async function(e) {
      e.preventDefault();

      if (!isAuthenticated) {
        self.showSnackbar('Debes autorizar con Google primero', 'warning');
        return;
      }

      const email = document.getElementById("email").value;
      const fecha = document.getElementById("fecha").value;
      const horaInicio = document.getElementById("hora_inicio").value;
      const horaFin = document.getElementById("hora_fin").value;
      const calendarId = document.getElementById("calendar_dropdown").value;

      if (!calendarId || !fecha || !horaInicio || !horaFin) {
        self.showSnackbar('Por favor completa todos los campos obligatorios', 'warning');
        return;
      }

      const startDateTime = new Date(`${fecha}T${horaInicio}:00`);
      const endDateTime = new Date(`${fecha}T${horaFin}:00`);

      const leadId = APP.data.current_card.id;
      const leadUri = document.getElementById("page_holder").baseURI;

      try {
        self.showSnackbar('Creando evento...', 'info', 2000);

        const leadResponse = await $.ajax({
          url: '/api/v4/leads/' + leadId,
          method: 'GET',
          dataType: 'json',
        });

        const leadName = leadResponse.name;
        const responsibleUserId = leadResponse.responsible_user_id;

        // Asignar nombre del usuario responsable manualmente basado en el ID
        let responsibleUserName = 'Usuario desconocido';

        switch (responsibleUserId) {
          case 13786792:
            responsibleUserName = 'Valeria';
            break;
          case 8001812:
            responsibleUserName = 'Juan Carlos';
            break;
          default:
            responsibleUserName = 'Usuario no identificado';
            break;
        }

        const event = {
          summary: `Reunión con ${leadName}`,
          description: `Lead ID: ${leadId}\nEnlace del lead: ${leadUri}\nResponsable: ${responsibleUserName}`,
          start: {
            dateTime: startDateTime.toISOString(),
            timeZone: 'America/Lima',
          },
          end: {
            dateTime: endDateTime.toISOString(),
            timeZone: 'America/Lima',
          },
          conferenceData: {
            createRequest: {
              requestId: `meet-${Date.now()}`,
              conferenceSolutionKey: { type: "hangoutsMeet" },
              status: { statusCode: "pending" },
            },
          },
        };

        if (email && email.trim() !== "") {
          event.attendees = [{ email: email }];
        }

        // Crear evento usando el servidor
        const createdEvent = await serverFetch('/api/calendar/event', {
          method: 'POST',
          body: JSON.stringify({
            userId: kommoUserId,
            calendarId: calendarId,
            event: event
          })
        });

        const meetLink = createdEvent.conferenceData?.entryPoints?.find(
          (entry) => entry.entryPointType === "video"
        )?.uri || 'No se generó link de Meet';

        self.showSnackbar(`✅ Reunión creada con éxito. Link: ${meetLink}`, 'success', 5000);

        // PATCH: Actualizar el lead con el link de Meet y la fecha
        const fechaUnix = Math.floor(startDateTime.getTime() / 1000);
        console.log("Preparando PATCH al lead:", leadId, "con link:", meetLink, "y fecha:", fechaUnix);
        
        // Obtener IDs de campos desde la configuración
        const settings = self.get_settings();
        const meetLinkFieldId = parseInt(settings.meet_link_field_id) || 792794;
        const dateFieldId = parseInt(settings.date_field_id) || 792418;
        
        console.log("📝 Usando field_ids desde configuración:", { meetLinkFieldId, dateFieldId });

        await $.ajax({
          url: '/api/v4/leads/' + leadId,
          method: 'PATCH',
          contentType: 'application/json',
          data: JSON.stringify({
            custom_fields_values: [
              {
                field_id: meetLinkFieldId, // ID del campo para el link de Meet
                values: [{ value: meetLink }]
              },
              {
                field_id: dateFieldId, // ID del campo para la fecha
                values: [{ value: fechaUnix }]
              }
            ]
          }),
          success: function(data) {
            console.log("PATCH exitoso en el lead:", data);
            self.showSnackbar("Lead actualizado con datos de la reunión", 'info');
          },
          error: function(xhr, status, error) {
            console.error("Error en PATCH del lead:", status, error, xhr.responseText);
            self.showSnackbar("Error actualizando el lead", 'error');
          }
        });

        // Lógica del checkbox
        const checked = document.getElementById("cita_agendada_checkbox").checked;
        if (checked) {
          // Cambia el status_id del lead (ajusta el ID de etapa según tu pipeline)
          const NUEVO_STATUS_ID = 56495775; // <-- Reemplaza por el status_id real de "Cita agendada"
          console.log("Moviendo lead a etapa 'Cita agendada' con status_id:", NUEVO_STATUS_ID);
          await $.ajax({
            url: '/api/v4/leads/' + leadId,
            method: 'PATCH',
            contentType: 'application/json',
            data: JSON.stringify({status_id: NUEVO_STATUS_ID }),
            success: function(data) {
              console.log("Lead movido de etapa:", data);
              self.showSnackbar("Lead movido a etapa 'Cita agendada'", 'success');
            },
            error: function(xhr, status, error) {
              console.error("Error moviendo lead de etapa:", status, error, xhr.responseText);
              self.showSnackbar("Error moviendo lead de etapa", 'error');
            }
          });
        } else {
          // Ejecuta el bot (ajusta los parámetros según tu configuración)
          const ID_BOT = 40555; // <-- Reemplaza por el ID real de tu bot
          console.log("Ejecutando Salesbot con ID:", ID_BOT, "para lead:", leadId);
          launchSalesbot(ID_BOT, leadId);
          self.showSnackbar("Ejecutando Salesbot automáticamente", 'info');
        }
      } catch (error) {
        console.error("Error creando el evento:", error);
        self.showSnackbar("Error creando la reunión", 'error');
      }
    };

    // ========================================
    // RENDERIZADO DE PÁGINA DE SETTINGS (CUSTOM FIELD)
    // ========================================
    
    // Construir interfaz personalizada en el campo custom de settings
    this.buildCustomSettingsUI = async function(customContentId, customInputId) {
      console.log('🎨 [CUSTOM_UI] ========================================');
      console.log('🎨 [CUSTOM_UI] Construyendo interfaz personalizada...');
      console.log('🎨 [CUSTOM_UI] customContentId recibido:', customContentId);
      console.log('🎨 [CUSTOM_UI] customInputId recibido:', customInputId);
      
      const container = document.getElementById(customContentId);
      const hiddenInput = document.getElementById(customInputId);
      
      console.log('🎨 [CUSTOM_UI] Container encontrado?:', !!container);
      console.log('🎨 [CUSTOM_UI] Container element:', container);
      console.log('🎨 [CUSTOM_UI] Hidden input encontrado?:', !!hiddenInput);
      console.log('🎨 [CUSTOM_UI] Hidden input element:', hiddenInput);
      
      if (!container) {
        console.error('❌ [CUSTOM_UI] No se encontró el contenedor:', customContentId);
        console.error('❌ [CUSTOM_UI] Buscando elementos alternativos...');
        
        // Buscar cualquier div que contenga "custom" en el ID
        const allCustomDivs = document.querySelectorAll('div[id*="custom"]');
        console.error('❌ [CUSTOM_UI] Divs con "custom" encontrados:', allCustomDivs.length);
        allCustomDivs.forEach(div => {
          console.error('  - Candidato:', div.id, div);
        });
        
        // Intentar buscar en el DOM completo
        console.error('❌ [CUSTOM_UI] Estructura del DOM en settings:');
        console.error(document.body.innerHTML.substring(0, 2000));
        
        return;
      }
      
      console.log('✅ [CUSTOM_UI] Contenedor encontrado correctamente');
      console.log('✅ [CUSTOM_UI] Iniciando construcción de HTML...');
      
      // Forzar visibilidad del contenedor y sus padres
      container.style.display = 'block';
      container.style.visibility = 'visible';
      container.style.opacity = '1';
      container.style.height = 'auto';
      container.style.overflow = 'visible';
      
      // Verificar estilos computados del contenedor
      const computedStyles = window.getComputedStyle(container);
      console.log('🎨 [CUSTOM_UI] Estilos computados del contenedor:');
      console.log('  - display:', computedStyles.display);
      console.log('  - visibility:', computedStyles.visibility);
      console.log('  - opacity:', computedStyles.opacity);
      console.log('  - height:', computedStyles.height);
      console.log('  - overflow:', computedStyles.overflow);
      
      // Verificar el padre del contenedor y forzar visibilidad
      let parentElement = container.parentElement;
      while (parentElement && parentElement !== document.body) {
        console.log('🎨 [CUSTOM_UI] Verificando padre:', parentElement.tagName, parentElement.className, parentElement.id);
        const parentStyles = window.getComputedStyle(parentElement);
        console.log('  - display:', parentStyles.display);
        
        // Forzar visibilidad si está oculto
        if (parentStyles.display === 'none') {
          console.log('⚠️ [CUSTOM_UI] Padre oculto - forzando visibilidad');
          parentElement.style.display = 'block';
        }
        if (parentStyles.visibility === 'hidden') {
          parentElement.style.visibility = 'visible';
        }
        
        parentElement = parentElement.parentElement;
      }
      
      // Cargar configuración guardada del input hidden
      let savedConfig = {};
      try {
        if (hiddenInput && hiddenInput.value) {
          savedConfig = JSON.parse(hiddenInput.value);
          console.log('📦 [CUSTOM_UI] Configuración cargada:', savedConfig);
        }
      } catch (e) {
        console.warn('⚠️ [CUSTOM_UI] Error parseando configuración:', e);
      }
      
      // Construir HTML de la interfaz
      const html = `
        <div style="padding: 20px; background: transparent; border-radius: 8px;">
          <h2 style="margin-top: 0; color: white;">⚙️ Configuración de Google Calendar</h2>
          
          <!-- Sección de Autenticación -->
          <div style="background: rgba(255,255,255,0.1); padding: 15px; margin-bottom: 15px; border-radius: 4px; border: 1px solid rgba(255,255,255,0.2);">
            <h3 style="margin-top: 0; font-size: 16px; color: white;">🔐 Autenticación de Google</h3>
            <p style="color: rgba(255,255,255,0.8); font-size: 14px;">Conecta tu cuenta de Google Calendar para crear eventos automáticamente.</p>
            <button type="button" id="gc_authorize_button" style="padding: 10px 20px; background-color: #4285f4; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 14px;">
              Conectar con Google Calendar
            </button>
            <button type="button" id="gc_signout_button" style="display: none; padding: 10px 20px; background-color: #dc3545; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 14px; margin-left: 10px;">
              Desconectar
            </button>
            <div id="gc_auth_status" style="margin-top: 10px; padding: 10px; border-radius: 4px; display: none;"></div>
          </div>
          
          <!-- Sección de Calendarios -->
          <div id="gc_calendar_section" style="background: rgba(255,255,255,0.1); padding: 15px; margin-bottom: 15px; border-radius: 4px; border: 1px solid rgba(255,255,255,0.2); display: none;">
            <h3 style="margin-top: 0; font-size: 16px; color: white;">📅 Calendarios Disponibles</h3>
            <select id="gc_calendar_select" style="width: 100%; padding: 8px; border: 1px solid rgba(255,255,255,0.3); border-radius: 4px; background: rgba(255,255,255,0.1); color: white;">
              <option value="">Cargando calendarios...</option>
            </select>
          </div>
          
          <!-- Sección de Mapeo de Campos -->
          <div id="gc_field_mapping" style="background: rgba(255,255,255,0.1); padding: 15px; margin-bottom: 15px; border-radius: 4px; border: 1px solid rgba(255,255,255,0.2); display: none;">
            <h3 style="margin-top: 0; font-size: 16px; color: white;">🔗 Mapeo de Campos Personalizados</h3>
            <p style="color: rgba(255,255,255,0.8); font-size: 14px;">Selecciona los campos donde se guardarán los datos de la reunión.</p>
            
            <label style="display: block; margin-bottom: 5px; font-weight: bold; color: white;">Campo para enlace de Meet:</label>
            <select id="gc_meet_field" style="width: 100%; padding: 8px; margin-bottom: 15px; border: 1px solid rgba(255,255,255,0.3); border-radius: 4px; background: rgba(255,255,255,0.1); color: white;">
              <option value="">Cargando campos...</option>
            </select>
            
            <label style="display: block; margin-bottom: 5px; font-weight: bold; color: white;">Campo para fecha de reunión:</label>
            <select id="gc_date_field" style="width: 100%; padding: 8px; margin-bottom: 15px; border: 1px solid rgba(255,255,255,0.3); border-radius: 4px; background: rgba(255,255,255,0.1); color: white;">
              <option value="">Cargando campos...</option>
            </select>
            
            <button type="button" id="gc_save_config" style="padding: 10px 20px; background-color: #28a745; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 14px;">
              💾 Guardar Configuración
            </button>
          </div>
          
          <!-- Instrucciones -->
          <div style="background: rgba(255,255,255,0.1); padding: 15px; border-radius: 4px; border: 1px solid rgba(255,255,255,0.2);">
            <h3 style="margin-top: 0; font-size: 16px; color: white;">ℹ️ Instrucciones</h3>
            <ol style="margin: 0; padding-left: 20px; color: rgba(255,255,255,0.9); font-size: 14px;">
              <li>Conecta tu cuenta de Google Calendar</li>
              <li>Selecciona el calendario predeterminado</li>
              <li>Elige los campos personalizados para guardar los datos</li>
              <li>Guarda la configuración</li>
              <li>Usa Quick Actions en las tarjetas de leads para crear eventos</li>
            </ol>
          </div>
        </div>
      `;
      
      container.innerHTML = html;
      console.log('✅ [CUSTOM_UI] HTML inyectado en el contenedor');
      
      // Vincular eventos
      self.bindCustomSettingsEvents(hiddenInput, savedConfig);
      
      // Cargar campos personalizados
      await self.loadCustomFieldsForSettings();
      
      // Verificar autenticación
      await self.checkAuthInCustomSettings();
    };
    
    // Vincular eventos de la interfaz custom de settings
    this.bindCustomSettingsEvents = function(hiddenInput, savedConfig) {
      console.log('🔗 [CUSTOM_UI] Vinculando eventos...');
      
      // Botón de autorización
      $('#gc_authorize_button').off('click').on('click', function() {
        self.authorizeGoogle();
      });
      
      // Botón de cerrar sesión
      $('#gc_signout_button').off('click').on('click', async function() {
        await self.signOutGoogle();
        await self.checkAuthInCustomSettings();
      });
      
      // Botón de guardar configuración
      $('#gc_save_config').off('click').on('click', async function() {
        const config = {
          meet_link_field_id: $('#gc_meet_field').val(),
          date_field_id: $('#gc_date_field').val(),
          calendar_id: $('#gc_calendar_select').val()
        };
        
        if (!config.meet_link_field_id || !config.date_field_id) {
          alert('Por favor selecciona ambos campos personalizados');
          return;
        }
        
        try {
          // Guardar en el servidor (base de datos)
          console.log('💾 [CUSTOM_UI] Guardando configuración en servidor...');
          const response = await fetch(`${SERVER_URL}/api/widget/config`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
              userId: kommoUserId,
              config: config
            })
          });
          
          if (!response.ok) {
            throw new Error('Error guardando en servidor');
          }
          
          console.log('✅ [CUSTOM_UI] Configuración guardada en servidor');
          
          // También guardar en el hidden input para compatibilidad
          if (hiddenInput) {
            hiddenInput.value = JSON.stringify(config);
            $(hiddenInput).trigger('change');
          }
          
          self.showSnackbar('✅ Configuración guardada correctamente', 'success');
          
        } catch (error) {
          console.error('❌ [CUSTOM_UI] Error guardando configuración:', error);
          
          // Fallback: guardar solo en hidden input
          if (hiddenInput) {
            hiddenInput.value = JSON.stringify(config);
            $(hiddenInput).trigger('change');
          }
          
          self.showSnackbar('⚠️ Guardado localmente (error en servidor)', 'warning');
        }
      });
      
      // Precargar valores guardados
      if (savedConfig.meet_link_field_id) {
        setTimeout(() => {
          $('#gc_meet_field').val(savedConfig.meet_link_field_id);
        }, 1000);
      }
      if (savedConfig.date_field_id) {
        setTimeout(() => {
          $('#gc_date_field').val(savedConfig.date_field_id);
        }, 1000);
      }
    };
    
    // Cargar campos personalizados para la interfaz custom de settings
    this.loadCustomFieldsForSettings = async function() {
      console.log('📋 [CUSTOM_UI] Cargando campos personalizados...');
      
      try {
        const response = await $.ajax({
          url: '/api/v4/leads/custom_fields',
          method: 'GET',
          dataType: 'json'
        });
        
        const customFields = response._embedded.custom_fields;
        console.log('📋 [CUSTOM_UI] Campos recibidos:', customFields.length);
        
        const meetSelect = $('#gc_meet_field');
        const dateSelect = $('#gc_date_field');
        
        if (meetSelect.length === 0 || dateSelect.length === 0) {
          console.warn('⚠️ [CUSTOM_UI] Selects no encontrados');
          return;
        }
        
        // Poblar dropdowns
        meetSelect.html('<option value=\"\">Selecciona un campo</option>');
        dateSelect.html('<option value=\"\">Selecciona un campo</option>');
        
        customFields.forEach(field => {
          // Campos de texto/URL para Meet Link
          if (field.type === 'text' || field.type === 'url') {
            meetSelect.append(`<option value=\"${field.id}\">${field.name} (ID: ${field.id})</option>`);
          }
          
          // Campos de fecha/timestamp para fecha
          if (field.type === 'date' || field.type === 'date_time' || field.type === 'timestamp') {
            dateSelect.append(`<option value=\"${field.id}\">${field.name} (ID: ${field.id})</option>`);
          }
        });
        
        console.log('✅ [CUSTOM_UI] Campos cargados en dropdowns');
        
      } catch (error) {
        console.error('❌ [CUSTOM_UI] Error cargando campos:', error);
      }
    };
    
    // Verificar autenticación en la interfaz custom de settings
    this.checkAuthInCustomSettings = async function() {
      console.log('🔐 [CUSTOM_UI] Verificando autenticación...');
      console.log('🔐 [CUSTOM_UI] kommoUserId:', kommoUserId);
      
      const localAuth = localStorage.getItem(`google_auth_${kommoUserId}`);
      const authTimestamp = localStorage.getItem(`google_auth_timestamp_${kommoUserId}`);
      const sevenDays = 7 * 24 * 60 * 60 * 1000;
      
      console.log('🔐 [CUSTOM_UI] localStorage google_auth:', localAuth);
      console.log('🔐 [CUSTOM_UI] localStorage timestamp:', authTimestamp);
      
      let authenticated = false;
      
      if (localAuth === 'true' && authTimestamp) {
        const isExpired = (Date.now() - parseInt(authTimestamp)) > sevenDays;
        authenticated = !isExpired;
        console.log('🔐 [CUSTOM_UI] Sesión expirada?:', isExpired);
      }
      
      console.log('🔐 [CUSTOM_UI] authenticated final:', authenticated);
      
      const authStatus = $('#gc_auth_status');
      const calendarSection = $('#gc_calendar_section');
      const fieldMapping = $('#gc_field_mapping');
      
      console.log('🔐 [CUSTOM_UI] Elementos jQuery encontrados:');
      console.log('  - authStatus:', authStatus.length, authStatus[0]);
      console.log('  - calendarSection:', calendarSection.length, calendarSection[0]);
      console.log('  - fieldMapping:', fieldMapping.length, fieldMapping[0]);
      
      if (authenticated) {
        console.log('✅ [CUSTOM_UI] Usuario autenticado - mostrando secciones');
        $('#gc_authorize_button').hide();
        $('#gc_signout_button').show();
        
        authStatus.show().css({
          backgroundColor: '#d4edda',
          color: '#155724'
        }).html('✅ Conectado a Google Calendar');
        
        calendarSection.show();
        fieldMapping.show();
        
        // Cargar calendarios
        await self.loadCalendarsInCustomSettings();
        
        // Cargar configuración guardada desde el servidor
        const savedConfig = await self.loadConfigFromServer();
        if (savedConfig) {
          console.log('📥 [CUSTOM_UI] Aplicando configuración guardada:', savedConfig);
          
          if (savedConfig.calendar_id) {
            $('#gc_calendar_select').val(savedConfig.calendar_id);
          }
          if (savedConfig.meet_link_field_id) {
            $('#gc_meet_field').val(savedConfig.meet_link_field_id);
          }
          if (savedConfig.date_field_id) {
            $('#gc_date_field').val(savedConfig.date_field_id);
          }
        }
        
      } else {
        console.log('⚠️ [CUSTOM_UI] Usuario NO autenticado - mostrando mensaje de advertencia');
        $('#gc_authorize_button').show();
        $('#gc_signout_button').show();
        
        authStatus.show().css({
          backgroundColor: '#f8d7da',
          color: '#721c24'
        }).html('⚠️ No conectado. Autoriza con Google Calendar.');
        
        calendarSection.hide();
        fieldMapping.hide();
        
        console.log('⚠️ [CUSTOM_UI] Secciones ocultas - se debe ver el botón de autorización');
      }
    };
    
    // Cargar calendarios en la interfaz custom de settings
    this.loadCalendarsInCustomSettings = async function() {
      console.log('📅 [CUSTOM_UI] Cargando calendarios...');
      
      try {
        const response = await fetch(`${SERVER_URL}/api/calendars?userId=${kommoUserId}`, {
          credentials: 'include'
        });
        
        if (!response.ok) throw new Error('Error obteniendo calendarios');
        
        const calendars = await response.json();
        const select = $('#gc_calendar_select');
        
        select.html('<option value=\"\">Selecciona un calendario</option>');
        
        calendars.forEach(calendar => {
          const option = `<option value=\"${calendar.id}\">${calendar.summary}</option>`;
          select.append(option);
          
          if (calendar.primary || calendar.id === 'primary') {
            select.val(calendar.id);
          }
        });
        
        console.log('✅ [CUSTOM_UI] Calendarios cargados');
        
      } catch (error) {
        console.error('❌ [CUSTOM_UI] Error cargando calendarios:', error);
      }
    };

    // ========================================
    // RENDERIZADO DE PÁGINA DE SETTINGS (DEPRECATED - USAR CUSTOM FIELD)
    // ========================================
    
    this.renderSettingsPage = async function() {
      console.log('⚙️ [SETTINGS] Renderizando página de configuración...');
      
      var html = '' +
        '<div class="km-google-calendar-widget" style="max-width: 800px;">' +
          '<h1>⚙️ Configuración de Google Calendar</h1>' +
          
          '<!-- Sección de Autenticación -->' +
          '<div style="border: 1px solid #ddd; padding: 20px; margin-bottom: 20px; border-radius: 8px;">' +
            '<h2 style="font-size: 18px; margin-bottom: 15px;">🔐 Autenticación de Google</h2>' +
            '<p style="color: #666; margin-bottom: 15px;">Conecta tu cuenta de Google Calendar para poder crear eventos automáticamente.</p>' +
            '<button id="authorize_button" style="background-color: #4285f4;">Conectar con Google Calendar</button>' +
            '<button id="signout_button" style="display: none; background-color: #dc3545;">Desconectar Google Calendar</button>' +
            '<div id="auth_status" style="margin-top: 15px; padding: 10px; border-radius: 4px; display: none;"></div>' +
          '</div>' +
          
          '<!-- Sección de Calendarios -->' +
          '<div id="calendar_section" style="border: 1px solid #ddd; padding: 20px; margin-bottom: 20px; border-radius: 8px; display: none;">' +
            '<h2 style="font-size: 18px; margin-bottom: 15px;">📅 Calendarios Disponibles</h2>' +
            '<p style="color: #666; margin-bottom: 15px;">Estos son los calendarios que puedes usar para crear eventos:</p>' +
            '<select id="settings_calendar_dropdown" style="width: 100%; padding: 10px; margin-bottom: 10px;">' +
              '<option value="" disabled selected>Cargando calendarios...</option>' +
            '</select>' +
          '</div>' +
          
          '<!-- Sección de Mapeo de Campos -->' +
          '<div id="field_mapping_section" style="border: 1px solid #ddd; padding: 20px; border-radius: 8px; display: none;">' +
            '<h2 style="font-size: 18px; margin-bottom: 15px;">🔗 Mapeo de Campos Personalizados</h2>' +
            '<p style="color: #666; margin-bottom: 15px;">Selecciona los campos donde se guardarán el enlace de Meet y la fecha de la reunión.</p>' +
            
            '<label for="meet_link_field_select">Campo para enlace de Meet:</label>' +
            '<select id="meet_link_field_select" style="margin-bottom: 20px;">' +
              '<option value="" disabled selected>Cargando campos...</option>' +
            '</select>' +
            
            '<label for="date_field_select">Campo para fecha de reunión:</label>' +
            '<select id="date_field_select" style="margin-bottom: 20px;">' +
              '<option value="" disabled selected>Cargando campos...</option>' +
            '</select>' +
            
            '<button id="save_field_mapping" style="background-color: #28a745;">💾 Guardar Configuración</button>' +
          '</div>' +
          
          '<!-- Instrucciones -->' +
          '<div style="margin-top: 20px; padding: 15px; background-color: #f8f9fa; border-radius: 8px;">' +
            '<h3 style="font-size: 16px; margin-bottom: 10px;">ℹ️ Instrucciones</h3>' +
            '<ol style="margin-left: 20px; color: #666;">' +
              '<li>Conecta tu cuenta de Google Calendar usando el botón de arriba</li>' +
              '<li>Selecciona el calendario predeterminado que deseas usar</li>' +
              '<li>Selecciona los campos personalizados donde se guardarán los datos</li>' +
              '<li>Guarda la configuración</li>' +
              '<li>¡Listo! Ahora puedes crear eventos desde las tarjetas de leads usando Quick Actions</li>' +
            '</ol>' +
          '</div>' +
        '</div>';
      
      self.render_template({
        caption: { html: '' },
        body: html,
        render: ''
      });
      
      console.log('⚙️ [SETTINGS] Template de settings renderizado');
      
      // Cargar campos personalizados de la API
      setTimeout(function() {
        self.loadCustomFields();
        self.checkExistingSessionInSettings();
      }, 200);
    };
    
    // Cargar campos personalizados de leads desde la API de Kommo
    this.loadCustomFields = async function() {
      console.log('📋 [SETTINGS] Cargando campos personalizados...');
      try {
        const response = await $.ajax({
          url: '/api/v4/leads/custom_fields',
          method: 'GET',
          dataType: 'json'
        });
        
        const customFields = response._embedded.custom_fields;
        console.log('📋 [SETTINGS] Campos personalizados recibidos:', customFields.length);
        
        const meetLinkSelect = document.getElementById('meet_link_field_select');
        const dateFieldSelect = document.getElementById('date_field_select');
        
        if (!meetLinkSelect || !dateFieldSelect) {
          console.warn('⚠️ [SETTINGS] Dropdowns de campos no encontrados');
          return;
        }
        
        // Obtener configuración guardada
        const settings = self.get_settings();
        const savedMeetLinkFieldId = settings.meet_link_field_id;
        const savedDateFieldId = settings.date_field_id;
        
        // Limpiar y poblar dropdown de Meet Link
        meetLinkSelect.innerHTML = '<option value="" disabled selected>Selecciona un campo</option>';
        dateFieldSelect.innerHTML = '<option value="" disabled selected>Selecciona un campo</option>';
        
        customFields.forEach(field => {
          // Solo mostrar campos de texto/URL para Meet Link
          if (field.type === 'text' || field.type === 'url') {
            const option = document.createElement('option');
            option.value = field.id;
            option.textContent = `${field.name} (ID: ${field.id})`;
            if (savedMeetLinkFieldId && field.id == savedMeetLinkFieldId) {
              option.selected = true;
            }
            meetLinkSelect.appendChild(option);
          }
          
          // Solo mostrar campos de fecha/timestamp para fecha
          if (field.type === 'date' || field.type === 'date_time' || field.type === 'timestamp') {
            const option = document.createElement('option');
            option.value = field.id;
            option.textContent = `${field.name} (ID: ${field.id})`;
            if (savedDateFieldId && field.id == savedDateFieldId) {
              option.selected = true;
            }
            dateFieldSelect.appendChild(option);
          }
        });
        
        console.log('✅ [SETTINGS] Campos personalizados cargados en dropdowns');
        
      } catch (error) {
        console.error('❌ [SETTINGS] Error cargando campos personalizados:', error);
        self.showSnackbar('Error cargando campos personalizados', 'error');
      }
    };
    
    // Verificar sesión en la página de settings
    this.checkExistingSessionInSettings = async function() {
      console.log('⚙️ [SETTINGS] Verificando sesión en settings...');
      
      // Verificar localStorage primero
      const localAuth = localStorage.getItem(`google_auth_${kommoUserId}`);
      const authTimestamp = localStorage.getItem(`google_auth_timestamp_${kommoUserId}`);
      const sevenDays = 7 * 24 * 60 * 60 * 1000;
      
      let authenticated = false;
      
      if (localAuth === 'true' && authTimestamp) {
        const isExpired = (Date.now() - parseInt(authTimestamp)) > sevenDays;
        if (!isExpired) {
          authenticated = true;
          console.log('✅ [SETTINGS] Sesión válida en localStorage');
        }
      }
      
      // Actualizar UI de settings
      const authStatus = document.getElementById('auth_status');
      const calendarSection = document.getElementById('calendar_section');
      const fieldMappingSection = document.getElementById('field_mapping_section');
      
      if (authenticated) {
        $('#authorize_button').hide();
        $('#signout_button').show();
        
        if (authStatus) {
          authStatus.style.display = 'block';
          authStatus.style.backgroundColor = '#d4edda';
          authStatus.style.color = '#155724';
          authStatus.innerHTML = '✅ Conectado a Google Calendar';
        }
        
        if (calendarSection) calendarSection.style.display = 'block';
        if (fieldMappingSection) fieldMappingSection.style.display = 'block';
        
        // Cargar calendarios
        await self.loadCalendarsInSettings();
      } else {
        $('#authorize_button').show();
        $('#signout_button').hide();
        
        if (authStatus) {
          authStatus.style.display = 'block';
          authStatus.style.backgroundColor = '#f8d7da';
          authStatus.style.color = '#721c24';
          authStatus.innerHTML = '⚠️ No conectado. Por favor autoriza con Google Calendar.';
        }
        
        if (calendarSection) calendarSection.style.display = 'none';
        if (fieldMappingSection) fieldMappingSection.style.display = 'none';
      }
    };
    
    // Cargar calendarios en la página de settings
    this.loadCalendarsInSettings = async function() {
      console.log('📅 [SETTINGS] Cargando calendarios en settings...');
      try {
        const response = await fetch(`${SERVER_URL}/api/calendars?userId=${kommoUserId}`, {
          credentials: 'include'
        });
        
        if (!response.ok) {
          throw new Error('Error obteniendo calendarios');
        }
        
        const calendars = await response.json();
        console.log('📅 [SETTINGS] Calendarios recibidos:', calendars.length);
        
        const dropdown = document.getElementById('settings_calendar_dropdown');
        if (dropdown) {
          dropdown.innerHTML = '<option value="" disabled selected>Selecciona un calendario predeterminado</option>';
          
          calendars.forEach((calendar) => {
            const option = document.createElement('option');
            option.value = calendar.id;
            option.textContent = calendar.summary;
            
            if (calendar.primary || calendar.id === 'primary') {
              option.selected = true;
            }
            
            dropdown.appendChild(option);
          });
        }
      } catch (error) {
        console.error('❌ [SETTINGS] Error cargando calendarios:', error);
      }
    };
    
    // Guardar mapeo de campos desde settings
    this.saveFieldMapping = function() {
      console.log('💾 [SETTINGS] Guardando configuración de campos...');
      
      const meetLinkFieldId = document.getElementById('meet_link_field_select').value;
      const dateFieldId = document.getElementById('date_field_select').value;
      
      if (!meetLinkFieldId || !dateFieldId) {
        self.showSnackbar('Por favor selecciona ambos campos', 'warning');
        return;
      }
      
      // Guardar en la configuración del widget
      self.set_settings({
        meet_link_field_id: meetLinkFieldId,
        date_field_id: dateFieldId,
        google_calendar_configured: 'true'
      });
      
      console.log('✅ [SETTINGS] Configuración guardada:', { meetLinkFieldId, dateFieldId });
      self.showSnackbar('✅ Configuración guardada correctamente', 'success');
    };

    // ========================================
    // RENDERIZADO DE SUBMISSION CONTROL
    // ========================================
    
    // Renderizar formulario en el submission control (área de envío en el feed)
    this.renderSubmissionControl = async function($el) {
      console.log('📝 [SUBMISSION] Renderizando control de agendamiento...');
      
      // Verificar si está configurado
      const localAuth = localStorage.getItem(`google_auth_${kommoUserId}`);
      const authTimestamp = localStorage.getItem(`google_auth_timestamp_${kommoUserId}`);
      const sevenDays = 7 * 24 * 60 * 60 * 1000;
      let isConfigured = false;
      
      if (localAuth === 'true' && authTimestamp) {
        const isExpired = (Date.now() - parseInt(authTimestamp)) > sevenDays;
        isConfigured = !isExpired;
      }
      
      if (!isConfigured) {
        $el.html(`
          <div style="padding: 15px; background-color: #fff3cd; border-radius: 8px;">
            <p style="color: #856404; margin: 0;">⚠️ <strong>Configuración requerida</strong></p>
            <p style="color: #856404; margin-top: 10px; font-size: 13px;">Por favor ve a la página de <strong>Configuración</strong> del widget para conectar tu cuenta de Google Calendar.</p>
          </div>
        `);
        return;
      }
      
      // Obtener datos del lead
      const leadId = APP.data.current_card.id;
      let leadName = '';
      let email = '';
      
      try {
        const leadResponse = await $.ajax({
          url: `/api/v4/leads/${leadId}?with=contacts`,
          method: 'GET',
          dataType: 'json',
        });
        
        leadName = leadResponse.name;
        
        console.log('📧 [SUBMISSION] leadResponse._embedded:', leadResponse._embedded);
        console.log('📧 [SUBMISSION] contacts:', leadResponse._embedded?.contacts);
        
        // Verificar que existan contactos antes de acceder
        const mainContact = leadResponse._embedded?.contacts?.find(contact => contact.is_main);
        if (mainContact) {
          const contactId = mainContact.id;
          const contactResponse = await $.ajax({
            url: `/api/v4/contacts/${contactId}`,
            method: 'GET',
            dataType: 'json',
          });
          
          console.log('📧 [SUBMISSION] contactResponse:', contactResponse);
          console.log('📧 [SUBMISSION] custom_fields_values:', contactResponse.custom_fields_values);
          
          // Verificar que existan custom_fields_values antes de acceder
          const emailField = contactResponse.custom_fields_values?.find(field => field.field_code === 'EMAIL');
          if (emailField && emailField.values.length > 0) {
            email = emailField.values[0].value;
          }
        }
      } catch (error) {
        console.error("❌ [SUBMISSION] Error obteniendo datos del lead:", error);
      }
      
      // Renderizar formulario compacto
      const html = `
        <div id="gc_submission_form" style="padding: 15px; background: #f9f9f9; border-radius: 8px;">
          <h3 style="margin: 0 0 15px 0; font-size: 16px; color: #333;">📅 Crear Reunión de Google Calendar</h3>
          
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 10px;">
            <div>
              <label style="display: block; font-size: 12px; margin-bottom: 3px; font-weight: bold;">Nombre:</label>
              <input type="text" id="gc_sub_nombre" value="${leadName}" style="width: 100%; padding: 6px; border: 1px solid #ccc; border-radius: 4px; font-size: 13px;">
            </div>
            <div>
              <label style="display: block; font-size: 12px; margin-bottom: 3px; font-weight: bold;">Email:</label>
              <input type="email" id="gc_sub_email" value="${email}" style="width: 100%; padding: 6px; border: 1px solid #ccc; border-radius: 4px; font-size: 13px;">
            </div>
          </div>
          
          <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; margin-bottom: 10px;">
            <div>
              <label style="display: block; font-size: 12px; margin-bottom: 3px; font-weight: bold;">Fecha:</label>
              <input type="date" id="gc_sub_fecha" style="width: 100%; padding: 6px; border: 1px solid #ccc; border-radius: 4px; font-size: 13px;">
            </div>
            <div>
              <label style="display: block; font-size: 12px; margin-bottom: 3px; font-weight: bold;">Hora inicio:</label>
              <input type="time" id="gc_sub_hora_inicio" style="width: 100%; padding: 6px; border: 1px solid #ccc; border-radius: 4px; font-size: 13px;">
            </div>
            <div>
              <label style="display: block; font-size: 12px; margin-bottom: 3px; font-weight: bold;">Hora fin:</label>
              <input type="time" id="gc_sub_hora_fin" style="width: 100%; padding: 6px; border: 1px solid #ccc; border-radius: 4px; font-size: 13px;">
            </div>
          </div>
          
          <div style="margin-bottom: 10px;">
            <label style="display: block; font-size: 12px; margin-bottom: 3px; font-weight: bold;">Calendario:</label>
            <select id="gc_sub_calendar" style="width: 100%; padding: 6px; border: 1px solid #ccc; border-radius: 4px; font-size: 13px;">
              <option value="">Cargando calendarios...</option>
            </select>
          </div>
          
          <div style="margin-bottom: 10px;">
            <label style="display: inline-flex; align-items: center; font-size: 13px; cursor: pointer;">
              <input type="checkbox" id="gc_sub_mover_etapa" style="margin-right: 5px;">
              Mover a etapa "Cita agendada"
            </label>
          </div>
          
          <button id="gc_sub_crear_evento" style="width: 100%; padding: 10px; background-color: #28a745; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 14px; font-weight: bold;">
            ✅ Crear Reunión
          </button>
        </div>
      `;
      
      $el.html(html);
      
      // Cargar calendarios
      await self.loadCalendarsInSubmission();
      
      // Vincular eventos
      self.bindSubmissionEvents();
      
      // Autocompletar hora de fin al cambiar hora de inicio
      $('#gc_sub_hora_inicio').on('input', function() {
        const horaInicio = $(this).val();
        if (horaInicio) {
          const [hours, minutes] = horaInicio.split(':').map(Number);
          const date = new Date();
          date.setHours(hours, minutes + 30);
          const horaFin = date.toTimeString().slice(0, 5);
          $('#gc_sub_hora_fin').val(horaFin);
        }
      });
    };
    
    // Cargar calendarios en submission control
    this.loadCalendarsInSubmission = async function() {
      console.log('📅 [SUBMISSION] Cargando calendarios...');
      try {
        const response = await fetch(`${SERVER_URL}/api/calendars?userId=${kommoUserId}`, {
          credentials: 'include'
        });
        
        if (!response.ok) throw new Error('Error obteniendo calendarios');
        
        const calendars = await response.json();
        const select = $('#gc_sub_calendar');
        
        select.html('<option value="">Selecciona un calendario</option>');
        
        calendars.forEach(calendar => {
          const option = `<option value="${calendar.id}">${calendar.summary}</option>`;
          select.append(option);
          
          if (calendar.primary || calendar.id === 'primary') {
            select.val(calendar.id);
          }
        });
        
        console.log('✅ [SUBMISSION] Calendarios cargados');
        
      } catch (error) {
        console.error('❌ [SUBMISSION] Error cargando calendarios:', error);
        // Fallback a calendarios estáticos
        const select = $('#gc_sub_calendar');
        select.html(`
          <option value="">Selecciona un calendario</option>
          <option value="primary" selected>Holos Digital Partners | Ventas</option>
        `);
      }
    };
    
    // Vincular eventos del submission control
    this.bindSubmissionEvents = function() {
      console.log('🔗 [SUBMISSION] Vinculando eventos...');
      
      $('#gc_sub_crear_evento').off('click').on('click', async function() {
        await self.createEventFromSubmission();
      });
    };
    
    // Crear evento desde el submission control
    this.createEventFromSubmission = async function() {
      console.log('📝 [SUBMISSION] Creando evento...');
      
      const email = $('#gc_sub_email').val();
      const fecha = $('#gc_sub_fecha').val();
      const horaInicio = $('#gc_sub_hora_inicio').val();
      const horaFin = $('#gc_sub_hora_fin').val();
      const calendarId = $('#gc_sub_calendar').val();
      
      if (!fecha || !horaInicio || !horaFin || !calendarId) {
        self.showSnackbar('Por favor completa todos los campos obligatorios', 'warning');
        return;
      }
      
      const startDateTime = new Date(`${fecha}T${horaInicio}:00`);
      const endDateTime = new Date(`${fecha}T${horaFin}:00`);
      
      const leadId = APP.data.current_card.id;
      const leadUri = document.getElementById("page_holder").baseURI;
      
      try {
        self.showSnackbar('Creando evento...', 'info', 2000);
        
        const leadResponse = await $.ajax({
          url: '/api/v4/leads/' + leadId,
          method: 'GET',
          dataType: 'json',
        });
        
        const leadName = leadResponse.name;
        const responsibleUserId = leadResponse.responsible_user_id;
        
        let responsibleUserName = 'Usuario desconocido';
        switch (responsibleUserId) {
          case 13786792:
            responsibleUserName = 'Valeria';
            break;
          case 8001812:
            responsibleUserName = 'Juan Carlos';
            break;
          default:
            responsibleUserName = 'Usuario no identificado';
            break;
        }
        
        const event = {
          summary: `Reunión con ${leadName}`,
          description: `Lead ID: ${leadId}\nEnlace del lead: ${leadUri}\nResponsable: ${responsibleUserName}`,
          start: {
            dateTime: startDateTime.toISOString(),
            timeZone: 'America/Lima',
          },
          end: {
            dateTime: endDateTime.toISOString(),
            timeZone: 'America/Lima',
          },
          conferenceData: {
            createRequest: {
              requestId: `meet-${Date.now()}`,
              conferenceSolutionKey: { type: "hangoutsMeet" },
              status: { statusCode: "pending" },
            },
          },
        };
        
        if (email && email.trim() !== "") {
          event.attendees = [{ email: email }];
        }
        
        const createdEvent = await serverFetch('/api/calendar/event', {
          method: 'POST',
          body: JSON.stringify({
            userId: kommoUserId,
            calendarId: calendarId,
            event: event
          })
        });
        
        const meetLink = createdEvent.conferenceData?.entryPoints?.find(
          (entry) => entry.entryPointType === "video"
        )?.uri || 'No se generó link de Meet';
        
        self.showSnackbar(`✅ Reunión creada con éxito. Link: ${meetLink}`, 'success', 5000);
        
        // PATCH al lead
        const fechaUnix = Math.floor(startDateTime.getTime() / 1000);
        const settings = self.get_settings();
        const meetLinkFieldId = parseInt(settings.meet_link_field_id) || 792794;
        const dateFieldId = parseInt(settings.date_field_id) || 792418;
        
        await $.ajax({
          url: '/api/v4/leads/' + leadId,
          method: 'PATCH',
          contentType: 'application/json',
          data: JSON.stringify({
            custom_fields_values: [
              {
                field_id: meetLinkFieldId,
                values: [{ value: meetLink }]
              },
              {
                field_id: dateFieldId,
                values: [{ value: fechaUnix }]
              }
            ]
          }),
          success: function(data) {
            console.log("✅ [SUBMISSION] PATCH exitoso en el lead:", data);
            self.showSnackbar("Lead actualizado con datos de la reunión", 'info');
          },
          error: function(xhr, status, error) {
            console.error("❌ [SUBMISSION] Error en PATCH del lead:", status, error, xhr.responseText);
            self.showSnackbar("Error actualizando el lead", 'error');
          }
        });
        
        // Lógica del checkbox
        const checked = $('#gc_sub_mover_etapa').is(':checked');
        if (checked) {
          const NUEVO_STATUS_ID = 56495775;
          await $.ajax({
            url: '/api/v4/leads/' + leadId,
            method: 'PATCH',
            contentType: 'application/json',
            data: JSON.stringify({ status_id: NUEVO_STATUS_ID }),
            success: function(data) {
              console.log("✅ [SUBMISSION] Lead movido de etapa:", data);
              self.showSnackbar("Lead movido a etapa 'Cita agendada'", 'success');
            },
            error: function(xhr, status, error) {
              console.error("❌ [SUBMISSION] Error moviendo lead de etapa:", status, error, xhr.responseText);
              self.showSnackbar("Error moviendo lead de etapa", 'error');
            }
          });
        } else {
          const ID_BOT = 40555;
          launchSalesbot(ID_BOT, leadId);
          self.showSnackbar("Ejecutando Salesbot automáticamente", 'info');
        }
        
        // Limpiar formulario
        $('#gc_sub_fecha').val('');
        $('#gc_sub_hora_inicio').val('');
        $('#gc_sub_hora_fin').val('');
        
      } catch (error) {
        console.error("❌ [SUBMISSION] Error creando el evento:", error);
        self.showSnackbar("Error creando la reunión", 'error');
      }
    };

    // Event listener para mensajes del servidor después de autenticación
    window.addEventListener('message', async (event) => {
      console.log('📨 [MESSAGE] Mensaje recibido:', event.data);
      
      if (event.data.type === 'GOOGLE_AUTH_SUCCESS') {
        console.log('✅ [MESSAGE] Autenticación exitosa desde servidor para usuario:', event.data.userId);
        
        // Guardar estado en localStorage como fallback para cookies cross-origin
        localStorage.setItem(`google_auth_${kommoUserId}`, 'true');
        localStorage.setItem(`google_auth_timestamp_${kommoUserId}`, Date.now().toString());
        console.log('💾 [MESSAGE] Estado guardado en localStorage');
        
        isAuthenticated = true;
        
        // Detectar si estamos en settings o en card
        const currentArea = self.system().area;
        
        if (currentArea === 'settings') {
          // Actualizar UI de settings (campo custom)
          await self.checkAuthInCustomSettings();
          self.showSnackbar('✅ Autorización exitosa', 'success');
        } else {
          // Actualizar UI de card (comportamiento anterior)
          const formulario = document.getElementById("formulario");
          if (formulario) {
            formulario.style.display = "block";
          }
          $('#authorize_button').hide();
          $('#signout_button').show();
          
          // Cargar calendarios
          await self.loadCalendarsFromServer();
          
          self.showSnackbar('✅ Autorización exitosa', 'success');
        }
        
      } else if (event.data.type === 'GOOGLE_AUTH_ERROR') {
        console.error('❌ [MESSAGE] Error de autenticación:', event.data.error);
        self.showSnackbar('Error en la autorización: ' + event.data.error, 'error');
      }
    });
    // Renderizar la plantilla del widget con los formularios
    this.renderTemplate = async function() {
      console.log('🟢 [RENDER] Renderizando formulario de eventos...');
      
      const leadId = APP.data.current_card.id;

      let leadName = '';
      let email = '';

      try {
        // Obtener datos del lead con contactos
        const leadResponse = await $.ajax({
          url: `/api/v4/leads/${leadId}?with=contacts`,
          method: 'GET',
          dataType: 'json',
        });

        leadName = leadResponse.name;
        
        console.log('📧 [TEMPLATE] leadResponse._embedded:', leadResponse._embedded);
        console.log('📧 [TEMPLATE] contacts:', leadResponse._embedded?.contacts);

        // Obtener el ID del contacto principal - verificar que existan contactos
        const mainContact = leadResponse._embedded?.contacts?.find(contact => contact.is_main);
        if (mainContact) {
          const contactId = mainContact.id;

          // Obtener datos del contacto principal
          const contactResponse = await $.ajax({
            url: `/api/v4/contacts/${contactId}`,
            method: 'GET',
            dataType: 'json',
          });

          console.log('📧 [TEMPLATE] contactResponse:', contactResponse);
          console.log('📧 [TEMPLATE] custom_fields_values:', contactResponse.custom_fields_values);
          
          // Extraer el email del contacto principal - verificar que existan custom_fields_values
          const emailField = contactResponse.custom_fields_values?.find(field => field.field_code === 'EMAIL');
          if (emailField && emailField.values.length > 0) {
            email = emailField.values[0].value;
          }
        }
      } catch (error) {
        console.error("Error obteniendo datos del lead o contacto:", error);
      }
      
      // Verificar si hay sesión activa
      const localAuth = localStorage.getItem(`google_auth_${kommoUserId}`);
      const authTimestamp = localStorage.getItem(`google_auth_timestamp_${kommoUserId}`);
      const sevenDays = 7 * 24 * 60 * 60 * 1000;
      let isConfigured = false;
      
      if (localAuth === 'true' && authTimestamp) {
        const isExpired = (Date.now() - parseInt(authTimestamp)) > sevenDays;
        isConfigured = !isExpired;
      }

      var html = '' +
        '<div class="km-google-calendar-widget">' +
          '<h1>📅 Agendar Reunión</h1>';
      
      if (!isConfigured) {
        html += '' +
          '<div style="padding: 20px; background-color: #fff3cd; border-radius: 8px; margin-bottom: 20px;">' +
            '<p style="color: #856404; margin: 0;">⚠️ <strong>Configuración requerida</strong></p>' +
            '<p style="color: #856404; margin-top: 10px;">Por favor ve a la página de <strong>Configuración</strong> del widget para conectar tu cuenta de Google Calendar.</p>' +
          '</div>';
      } else {
        html += '' +
          '<form id="reunionForm">' +
            '<label for="nombre">Nombre:</label>' +
            `<input type="text" id="nombre" value="${leadName}" required><br><br>` +
            '<label for="email">Correo electrónico:</label>' +
            `<input type="email" id="email" value="${email}"><br><br>` +
            '<label for="fecha">Fecha:</label>' +
            '<input type="date" id="fecha" required><br><br>' +
            '<label for="hora_inicio">Hora de inicio:</label>' +
            '<input type="time" id="hora_inicio" required><br><br>' +
            '<label for="hora_fin">Hora de fin:</label>' +
            '<input type="time" id="hora_fin" required><br><br>' +
            '<label for="calendar_dropdown">Seleccionar calendario:</label>' +
            '<select id="calendar_dropdown" required>' +
              '<option value="" disabled selected>Seleccione un calendario</option>' +
            '</select><br><br>' +
            '<label><input type="checkbox" id="cita_agendada_checkbox"> Mover a etapa "Cita agendada"</label><br><br>' +
            '<button type="submit">Crear evento</button>' +
          '</form>';
      }
      
      html += '</div>';

      self.render_template({
        caption: { html: '' },
        body: html,
        render: ''
      });
      
      console.log('🟢 [RENDER] Template renderizado');
      
      // Si está configurado, cargar calendarios
      if (isConfigured) {
        setTimeout(function() {
          console.log('🟢 [RENDER] Cargando calendarios en formulario...');
          
          // Si hay calendarios pendientes guardados durante init(), cargarlos ahora
          if (window.pendingCalendars && window.pendingCalendars.length > 0) {
            console.log('📅 [RENDER] Cargando calendarios pendientes:', window.pendingCalendars.length);
            const dropdown = document.getElementById("calendar_dropdown");
            if (dropdown) {
              dropdown.innerHTML = '<option value="" disabled selected>Seleccione un calendario</option>';
              window.pendingCalendars.forEach((calendar) => {
                const option = document.createElement("option");
                option.value = calendar.id;
                option.textContent = calendar.summary;
                if (calendar.primary || calendar.id === 'primary') {
                  option.selected = true;
                }
                dropdown.appendChild(option);
              });
              console.log(`✅ ${window.pendingCalendars.length} calendarios pendientes cargados`);
              window.pendingCalendars = null; // Limpiar después de cargar
            }
          } else {
            // Intentar cargar desde el servidor
            self.loadCalendarsFromServer();
          }
        }, 200);
      }
    };

    return this;
  };

  return CustomWidget;
});