define(['jquery'], function ($) {
  var CustomWidget = function () {
    var self = this;
    var isRendered = false; // Bandera para controlar la renderización

    this.callbacks = {
      settings: function () {
        return true;
      },
      init: function () {
        self.loadCSS();
        return true;
      },
      bind_actions: function () {
        $(document).on('click', '.js-open-calendly-popup', function () {
          self.openCalendlyPopup();
        });
        return true;
      },
      render: function () {
        // Condición para destruir el widget si no estamos en la página de la tarjeta
        if (APP.data.card_page == false) {
          self.callbacks.destroy();
        }

        if (isRendered) return true; // Evitar múltiples renderizaciones

        self.render_template({
          caption: {
            class_name: 'js-km-caption',
            html: 'Calendario de Holos'
          },
          body: '<div class="calendly-container">\
                   <button class="js-open-calendly-popup">Agendar Cita</button>\
                 </div>',
          render: ''
        });

        isRendered = true; // Marcar como renderizado
        return true;
      },
      onSave: function () {
        return true;
      },
      leads: {
        selected: function () {
          // Condición para destruir y reconstruir el widget si no estamos en la página de la tarjeta
          // if (APP.data.card_page === false) {
          //   self.callbacks.destroy();
          //   self.callbacks.init();
          //   self.callbacks.render();
          // }
          return true;
        }
      },
      destroy: function () {
        // Limpiar eventos y elementos del DOM relacionados con el popup
        // Restablecer la bandera de renderización
      }
    };

    this.loadCSS = function() {
      var settings = self.get_settings();
      var cssFilePath = settings.path + '/style.css?v=' + settings.version;
      if ($('link[href="' + cssFilePath + '"]').length < 1) {
        $('head').append('<link href="' + cssFilePath + '" type="text/css" rel="stylesheet">');
      }
    };

    this.getContactDetails = function(contactId) {
      const url = `/api/v4/contacts/${contactId}`;
      const options = {
        method: 'get',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      };

      return fetch(url, options)
        .then(response => response.json())
        .then(contactData => {
          let email = '';
          
          if (contactData.custom_fields_values) {
            contactData.custom_fields_values.forEach(field => {
              if (field.field_code === 'EMAIL') {
                email = field.values[0].value;
              }
            });
          }

          return {
            name: contactData.name,
            email: email
          };
        });
    };

    this.openCalendlyPopup = function() {
      // Eliminar cualquier popup existente antes de crear uno nuevo
      $('.calendly-popup-overlay').remove();

      const idLead = APP.data.current_card.id; // Obtener el ID del lead actual
      const leadUrl = `/api/v4/leads/${idLead}?with=contacts`;

      fetch(leadUrl, {
        method: 'get',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      })
      .then(response => response.json())
      .then(responseData => {
        const contacts = responseData._embedded.contacts;

        if (contacts && contacts.length > 0) {
          return self.getContactDetails(contacts[0].id);
        }
      })
      .then(contactDetails => {
        if (contactDetails) {
          const encodedName = encodeURIComponent(contactDetails.name);
          const encodedEmail = encodeURIComponent(contactDetails.email);
          const calendlyBaseURL = "https://calendly.com/holos-digital?background_color=f6f3f3&primary_color=2f2662";
          const customURL = calendlyBaseURL + `&name=${encodedName}&email=${encodedEmail}&a4=${idLead}`;

          const popupHTML = `<div class="calendly-popup-overlay">
                              <div class="calendly-popup-content">
                                <div class="calendly-inline-widget" data-url="${customURL}" style="min-width:100%;height:100%;"></div>
                                <button class="js-close-calendly-popup">Cerrar</button>
                              </div>
                            </div>`;
          document.body.insertAdjacentHTML('beforeend', popupHTML);

          // Cargar el script de Calendly y mostrar el widget
          const script = document.createElement('script');
          script.type = 'text/javascript';
          script.src = 'https://assets.calendly.com/assets/external/widget.js';
          script.async = true;
          document.head.appendChild(script);

          // Vincular eventos de cierre
          $(document).on('click', '.js-close-calendly-popup', function() {
            $('.calendly-popup-overlay').remove();
          });

          $(document).on('click', '.calendly-popup-overlay', function(event) {
            if (event.target === event.currentTarget) {
              $(this).remove();
            }
          });
        }
      });
    };

    return this;
  };
  return CustomWidget;
});
