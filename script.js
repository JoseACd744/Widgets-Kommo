define(['jquery'], function ($) {
  var CustomWidget = function () {
    var self = this;
    const SERVER_URL = 'https://servidor-calendar-widget-production.up.railway.app'; // Cambia esto a la URL de tu servidor en producción

    this.callbacks = {
      settings: function () {
        var $modal_body = $('.modal-body');
        var $widget_settings = $modal_body.find('.widget_settings_block');

        // HTML para los ajustes personalizados
        var settingsHTML = `
          <div class="km-form">
            <h3>Configuración del Widget</h3>
            <div class="button-container">
              <button id="authorize_button_settings" class="km-button">Iniciar sesión con Google</button>
            </div>
          </div>
        `;

        $widget_settings.html(settingsHTML);

        $('#authorize_button_settings').on('click', async function () {
          try {
            const response = await fetch(`${SERVER_URL}/auth-url`);
            const data = await response.json();
            if (data.url) {
              window.open(data.url, '_blank', 'width=600,height=600');
        
              // Escuchar el evento de cierre de la ventana para obtener el sessionId
              const interval = setInterval(async () => {
                const sessionResponse = await fetch(`${SERVER_URL}/check-session`);
                const sessionData = await sessionResponse.json();
                if (sessionData.session) {
                  localStorage.setItem('sessionId', sessionData.session.id);
                  clearInterval(interval);
                }
              }, 1000);
            } else {
              alert('No se pudo obtener la URL de autenticación.');
            }
          } catch (error) {
            console.error('Error iniciando la autorización:', error);
            alert('Error iniciando la autorización. Revisa la consola para más detalles.');
          }
        });

        return true;
      },

      init: function () {
        self.loadCSS();
        return true;
      },

      bind_actions: function () {
        $(document).off('click', '#authorize_button').on('click', '#authorize_button', function () {
          self.startAuthorization();
        });

        $(document).off('click', '#signout_button').on('click', '#signout_button', function () {
          self.signOut();
        });

        $(document).off('submit', '#reunionForm').on('submit', '#reunionForm', function (e) {
          self.createEvent(e);
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

    // Iniciar el proceso de autorización
      this.startAuthorization = async function () {
        try {
          console.log('Iniciando autorización...');
          const response = await fetch(`${SERVER_URL}/auth-url`);
          console.log('Respuesta del servidor:', response);
          const data = await response.json();
          console.log('Datos recibidos:', data);
      
          if (data.url) {
            // Abrir el modal y cargar la URL en un iframe
            const modalHTML = `
              <div id="authModal" class="km-modal">
                <div class="km-modal-content">
                  <span id="closeModal" class="km-close">&times;</span>
                  <iframe src="${data.url}" frameborder="0" style="width: 100%; height: 400px;"></iframe>
                </div>
              </div>
            `;
            $('body').append(modalHTML);
      
            // Mostrar el modal
            $('#authModal').fadeIn();
      
            // Cerrar el modal al hacer clic en la "X"
            $('#closeModal').on('click', function () {
              $('#authModal').fadeOut(function () {
                $(this).remove();
              });
            });
          } else {
            alert('No se pudo obtener la URL de autenticación.');
          }
        } catch (error) {
          console.error('Error iniciando la autorización:', error);
          alert('Error iniciando la autorización. Revisa la consola para más detalles.');
        }
      };
      
      // Estilos para el modal
      this.loadCSS = function () {
        var styles = `
          .km-modal {
            display: none;
            position: fixed;
            z-index: 1000;
            left: 0;
            top: 0;
            width: 100%;
            height: 100%;
            overflow: auto;
            background-color: rgba(0, 0, 0, 0.5);
          }
          .km-modal-content {
            background-color: #fefefe;
            margin: 15% auto;
            padding: 20px;
            border: 1px solid #888;
            width: 80%;
            max-width: 600px;
            border-radius: 10px;
          }
          .km-close {
            color: #aaa;
            float: right;
            font-size: 28px;
            font-weight: bold;
            cursor: pointer;
          }
          .km-close:hover,
          .km-close:focus {
            color: black;
            text-decoration: none;
          }
        `;
        $('head').append('<style>' + styles + '</style>');
      };
    
    this.createEvent = async function (e) {
      e.preventDefault();
    
      const sessionId = localStorage.getItem('sessionId');
      if (!sessionId) {
        alert('Por favor, inicia sesión primero.');
        return;
      }
    
      const nombre = document.getElementById("nombre").value;
      const email = document.getElementById("email").value;
      const fecha = document.getElementById("fecha").value;
      const hora = document.getElementById("hora").value;
      const duracion = document.getElementById("duracion").value;
      const calendarId = document.getElementById("calendar_select").value;
    
      const startDateTime = new Date(`${fecha}T${hora}:00`);
      const endDateTime = new Date(startDateTime.getTime() + duracion * 60000);
    
      const event = {
        summary: `Reunión con ${nombre}`,
        description: `Solicitada por ${nombre} (${email})`,
        start: {
          dateTime: startDateTime.toISOString(),
          timeZone: 'America/Lima',
        },
        end: {
          dateTime: endDateTime.toISOString(),
          timeZone: 'America/Lima',
        },
        attendees: [{ email: email }],
      };
    
      console.log('Datos del evento:', event);
    
      try {
        const response = await fetch(`${SERVER_URL}/create-event`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ sessionId, calendarId, event }),
        });
    
        console.log('Respuesta del servidor:', response);
        const data = await response.json();
        console.log('Datos recibidos:', data);
    
        if (response.ok) {
          alert('Reunión creada con éxito. Link: ' + data.event.htmlLink);
        } else {
          console.error('Error creando el evento:', data);
          alert('Error creando la reunión.');
        }
      } catch (error) {
        console.error('Error creando el evento:', error);
        alert('Error creando la reunión. Revisa la consola para más detalles.');
      }
    };
    
    this.renderTemplate = async function () {
      try {
        // Verificar si hay una sesión activa
        const response = await fetch(`${SERVER_URL}/check-session`, {
          credentials: 'include', // Incluir cookies en la solicitud
        });
    
        if (response.ok) {
          const data = await response.json();
          const sessionId = data.sessionId;
    
          console.log('Session ID obtenido del servidor:', sessionId);
    
          // Usar el sessionId para obtener los calendarios
          const calendarsResponse = await fetch(`${SERVER_URL}/calendars`, {
            credentials: 'include', // Incluir cookies en la solicitud
          });
    
          const calendars = await calendarsResponse.json();
          console.log('Calendarios obtenidos:', calendars);
    
          let calendarOptions = '';
          calendars.forEach(calendar => {
            calendarOptions += `<option value="${calendar.id}">${calendar.summary}</option>`;
          });
    
          var html = '' +
            '<div class="km-google-calendar-widget">' +
              '<h1>Agendar Reunión Automáticamente</h1>' +
              '<button id="authorize_button">Iniciar sesión con Google</button>' +
              '<button id="signout_button" style="display: none;">Cerrar sesión</button>' +
              '<div id="formulario">' +
                '<form id="reunionForm">' +
                  '<label for="nombre">Nombre:</label>' +
                  '<input type="text" id="nombre" required><br><br>' +
                  '<label for="email">Correo electrónico:</label>' +
                  '<input type="email" id="email" required><br><br>' +
                  '<label for="fecha">Fecha:</label>' +
                  '<input type="date" id="fecha" required><br><br>' +
                  '<label for="hora">Hora:</label>' +
                  '<input type="time" id="hora" required><br><br>' +
                  '<label for="duracion">Duración (minutos):</label>' +
                  '<input type="number" id="duracion" min="15" max="240" required><br><br>' +
                  '<label for="calendar_select">Seleccionar calendario:</label>' +
                  '<select id="calendar_select" required>' +
                    calendarOptions +
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
    
          $('#authorize_button').hide();
          $('#signout_button').show();
          $('#formulario').show();
        } else {
          console.log('No hay sesión activa.');
          $('#authorize_button').show();
          $('#signout_button').hide();
          $('#formulario').hide();
        }
      } catch (error) {
        console.error('Error verificando la sesión:', error);
        alert('Error verificando la sesión. Revisa la consola para más detalles.');
      }
    };
    
    // Cargar estilos CSS personalizados
    this.loadCSS = function () {
      var styles = `
        .km-form {
          padding: 15px;
          background: #2F2662;
          border: 1px solid #ddd;
          border-radius: 5px;
          max-width: 400px;
          margin: 0 auto;
        }
        .km-form .button-container {
          display: flex;
          justify-content: center;
        }
        .km-form button {
          padding: 10px 20px;
          color: #fff;
          background: #4CAF50;
          border: none;
          border-radius: 5px;
          cursor: pointer;
          font-size: 16px;
        }
        .km-form button:hover {
          background: #45a049;
        }
        .km-form h3 {
          color: #fff;
          text-align: center;
        }
      `;
      $('head').append('<style>' + styles + '</style>');
    };

    return this;
  };

  return CustomWidget;
});