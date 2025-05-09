define(['jquery'], function ($) {
  var CustomWidget = function () {
    var self = this;
    let tokenClient;
    let gapiInited = false;
    let gisInited = false;

    const CLIENT_ID = '187937463238-45e5o4l80hn1tkpiftvahfs5pf2druj6.apps.googleusercontent.com'; // ⚠️ Reemplaza esto
    const API_KEY = ''; // No necesario para esta operación específica
    const DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest';
    const SCOPES = 'https://www.googleapis.com/auth/calendar.events';

    this.callbacks = {
      settings: function () {
        return true;
      },
      init: function () {
        self.loadCSS();
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

    this.loadCalendars = function() {
      // Lista estática de calendarios
      const calendars = [
        { id: 'primary', summary: 'Holos Digital Partners | Ventas' },
        { id: 'c_586d8a87e53fe35bd3fb3e8a998a456f2db0a195f4192c2275a79662ddf70165@group.calendar.google.com', summary: 'Kommo, by Holos' },
        { id: 'c_462b71c22d24f69ce52edb36254bdd7ab97848aceaea241e01df359762bcfafa@group.calendar.google.com', summary: 'tldv meetings' },
        { id: 'c_5afd7289c6145e02223863817b7b2e5ccfb0742b56c66cbc8661b712583c5561@group.calendar.google.com', summary: 'Demo Kommo USA - Calendly' },
        { id: 'c_ba21c2fb63feda18d531228728292bcb4898d94b260ca4325679596fa2208d84@group.calendar.google.com', summary: 'Demo Kommo EC' }
      ];
    
      // Generar opciones para el dropdown
      const dropdown = document.getElementById("calendar_dropdown");
      calendars.forEach((calendar) => {
        const option = document.createElement("option");
        option.value = calendar.id;
        option.textContent = calendar.summary;
    
        // Seleccionar por defecto el calendario "primary"
        if (calendar.id === 'primary') {
          option.selected = true;
        }
    
        dropdown.appendChild(option);
      });
    };


    // Inicializar Google API
    this.gapiLoaded = function() {
      gapi.load('client', self.initializeGapiClient);
    };

    this.initializeGapiClient = async function() {
      await gapi.client.init({
        apiKey: API_KEY,
        discoveryDocs: [DISCOVERY_DOC],
        clientId: CLIENT_ID,
        scope: SCOPES,
        conferenceDataVersion: 1,
      });
      gapiInited = true;
    };

    // Inicializar Google OAuth
    this.gisLoaded = function() {
      tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPES,
        callback: (tokenResponse) => {
          if (tokenResponse.error) throw tokenResponse;
          document.getElementById("formulario").style.display = "block";
          $('#authorize_button').hide();
          $('#signout_button').show();
        },
      });
      gisInited = true; // Indicamos que la inicialización de Google OAuth está lista
    };

    // Función de autorización de Google
    this.authorizeGoogle = function() {
      if (gisInited) {
        tokenClient.requestAccessToken();
      } else {
        console.error('Google OAuth aún no está completamente cargado.');
      }
    };

    // Función de cierre de sesión
    this.signOutGoogle = function() {
      google.accounts.oauth2.revoke(gapi.client.getToken().access_token);
      gapi.client.setToken('');
      document.getElementById("formulario").style.display = "none";
      $('#authorize_button').show();
      $('#signout_button').hide();
    };

    // Crear un evento en el calendario seleccionado
    this.createEvent = async function(e) {
      e.preventDefault();
    
      const email = document.getElementById("email").value;
      const fecha = document.getElementById("fecha").value;
      const horaInicio = document.getElementById("hora_inicio").value;
      const horaFin = document.getElementById("hora_fin").value;
      const calendarId = document.getElementById("calendar_dropdown").value; // Obtener el calendarId seleccionado
    
      const startDateTime = new Date(`${fecha}T${horaInicio}:00`);
      const endDateTime = new Date(`${fecha}T${horaFin}:00`);
    
      const leadId = APP.data.current_card.id;
      const leadUri = document.getElementById("page_holder").baseURI;
    
      try {
        const leadResponse = await $.ajax({
          url: '/api/v4/leads/' + leadId,
          method: 'GET',
          dataType: 'json',
        });
    
        const leadName = leadResponse.name;
        const responsibleUserId = leadResponse.responsible_user_id;
    
        const userResponse = await $.ajax({
          url: '/api/v4/users/' + responsibleUserId,
          method: 'GET',
          dataType: 'json',
        });
    
        const responsibleUserName = userResponse.name;
    
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
          attendees: [{ email: email }],
          conferenceData: {
            createRequest: {
              requestId: `meet-${Date.now()}`,
              conferenceSolutionKey: { type: "hangoutsMeet" },
              status: { statusCode: "pending" },
            },
          },
        };
    
        const request = gapi.client.calendar.events.insert({
          calendarId: calendarId, // Usar el calendarId seleccionado
          resource: event,
          conferenceDataVersion: 1,
          sendUpdates: "all",
        });
    
        const response = await request;
        const meetLink = response.result.conferenceData.entryPoints.find(
          (entry) => entry.entryPointType === "video"
        ).uri;
    
        alert("Reunión creada con éxito. Link: " + meetLink);
      } catch (error) {
        console.error("Error creando el evento:", error);
        alert("Error creando la reunión.");
      }
    };

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
                  `<input type="email" id="email" value="${email}" required><br><br>` +
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
                  '<button type="submit">Crear evento</button>' +
                '</form>' +
              '</div>' +
            '</div>';
        
          self.render_template({
            caption: { html: '' },
            body: html,
            render: ''
          });
          self.loadCalendars(); // Cargar los calendarios al renderizar
        };

    return this;
  };

  return CustomWidget;
});