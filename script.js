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

    this.callbacks = {
      settings: function () {
        return true;
      },
      init: function () {
        // Obtener ID del usuario de Kommo
        try {
          if (APP.data.current_card && APP.data.current_card.user) {
            kommoUserId = APP.data.current_card.user.id || 'default-user';
            console.log('Kommo User ID:', kommoUserId, '- User Name:', APP.data.current_card.user.name);
          } else {
            kommoUserId = 'default-user';
            console.log('No se pudo obtener el usuario, usando default-user');
          }
        } catch (e) {
          console.error('Error obteniendo usuario de Kommo:', e);
          kommoUserId = 'default-user';
        }
        
        self.loadCSS();
        
        // Verificar si ya hay sesión activa en el servidor
        self.checkExistingSession();
        
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
        self.renderTemplate();
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
      try {
        const response = await fetch(`${SERVER_URL}/auth/status`, {
          credentials: 'include'
        });
        
        const data = await response.json();
        
        if (data.authenticated) {
          isAuthenticated = true;
          document.getElementById("formulario").style.display = "block";
          $('#authorize_button').hide();
          $('#signout_button').show();
          
          // Cargar calendarios desde el servidor
          await self.loadCalendarsFromServer();
          
          console.log('✅ Sesión restaurada desde el servidor');
          self.showSnackbar('Sesión activa', 'success', 2000);
        } else {
          isAuthenticated = false;
          document.getElementById("formulario").style.display = "none";
          $('#authorize_button').show();
          $('#signout_button').hide();
        }
      } catch (error) {
        console.error('Error verificando sesión:', error);
        // Si hay error, mostrar botón de autorización
        document.getElementById("formulario").style.display = "none";
        $('#authorize_button').show();
        $('#signout_button').hide();
      }
    };

    // Cargar calendarios desde el servidor
    this.loadCalendarsFromServer = async function() {
      try {
        const response = await fetch(`${SERVER_URL}/api/calendars`, {
          credentials: 'include'
        });
        
        if (!response.ok) {
          throw new Error('Error obteniendo calendarios');
        }
        
        const calendars = await response.json();
        
        if (!calendars || calendars.length === 0) {
          self.showSnackbar('No se encontraron calendarios', 'warning');
          self.loadStaticCalendars();
          return;
        }
        
        const dropdown = document.getElementById("calendar_dropdown");
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
        console.error('Error cargando calendarios desde servidor:', error);
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
      try {
        self.showSnackbar('Conectando con Google...', 'info', 2000);
        
        // Obtener URL de autorización del servidor
        const data = await serverFetch(`/auth/google/url?userId=${kommoUserId}`);
        
        if (!data.authUrl) {
          throw new Error('No se pudo obtener la URL de autorización');
        }
        
        // Abrir ventana emergente para autorización
        const width = 600;
        const height = 700;
        const left = (screen.width - width) / 2;
        const top = (screen.height - height) / 2;
        
        window.open(
          data.authUrl,
          'Google Authorization',
          `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`
        );
        
      } catch (error) {
        console.error('Error en autorización:', error);
        self.showSnackbar('Error conectando con el servidor: ' + error.message, 'error');
      }
    };

    // Función de cierre de sesión (usando servidor)
    this.signOutGoogle = async function() {
      try {
        await serverFetch('/auth/logout', { method: 'POST' });
        
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

        await $.ajax({
          url: '/api/v4/leads/' + leadId,
          method: 'PATCH',
          contentType: 'application/json',
          data: JSON.stringify({
            custom_fields_values: [
              {
                field_id: 792794, // ID del campo para el link de Meet
                values: [{ value: meetLink }]
              },
              {
                field_id: 792418, // ID del campo para la fecha
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

    // Event listener para mensajes del servidor después de autenticación
    window.addEventListener('message', async (event) => {
      if (event.data.type === 'GOOGLE_AUTH_SUCCESS') {
        console.log('✅ Autenticación exitosa desde servidor para usuario:', event.data.userId);
        
        isAuthenticated = true;
        document.getElementById("formulario").style.display = "block";
        $('#authorize_button').hide();
        $('#signout_button').show();
        
        // Cargar calendarios
        await self.loadCalendarsFromServer();
        
        self.showSnackbar('✅ Autorización exitosa', 'success');
        
      } else if (event.data.type === 'GOOGLE_AUTH_ERROR') {
        console.error('❌ Error de autenticación:', event.data.error);
        self.showSnackbar('Error en la autorización: ' + event.data.error, 'error');
      }
    });
    // Renderizar la plantilla del widget con los formularios
    this.renderTemplate = async function() {
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

        // Obtener el ID del contacto principal
        const mainContact = leadResponse._embedded.contacts.find(contact => contact.is_main);
        if (mainContact) {
          const contactId = mainContact.id;

          // Obtener datos del contacto principal
          const contactResponse = await $.ajax({
            url: `/api/v4/contacts/${contactId}`,
            method: 'GET',
            dataType: 'json',
          });

          // Extraer el email del contacto principal
          const emailField = contactResponse.custom_fields_values.find(field => field.field_code === 'EMAIL');
          if (emailField && emailField.values.length > 0) {
            email = emailField.values[0].value;
          }
        }
      } catch (error) {
        console.error("Error obteniendo datos del lead o contacto:", error);
      }

      var html = '' +
        '<div class="km-google-calendar-widget">' +
          '<h1>Agendar Reunión Automáticamente</h1>' +
          '<button id="authorize_button">Iniciar sesión con Google</button>' +
          '<button id="signout_button" style="display: none;">Cerrar sesión</button>' +
          '<div id="formulario" style="display: none;">' +
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
            '</form>' +
          '</div>' +
        '</div>';

      self.render_template({
        caption: { html: '' },
        body: html,
        render: ''
      });
      // Los calendarios se cargarán automáticamente después de la autorización
    };

    return this;
  };

  return CustomWidget;
});