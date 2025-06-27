define(["jquery"], function ($) {
  var CustomWidget = function () {
    var self = this;

    this.callbacks = {
      settings: function () { return true; },
      init: function () {
        console.log("INIT ejecutado");
        self.loadCSS();
        self.render();
        return true;
      },
      bind_actions: function () {
        console.log("Buscando el botón:", $("#guardarCambios-cajon").length);
        $(document)
          .off("click", "#guardarCambios-cajon")
          .on("click", "#guardarCambios-cajon", function () {
            console.log("Botón 'Guardar cambios' fue clickeado");
            self.saveData();
          });
        
        $(document)
          .off("change", "#status-select-cajon")
          .on("change", "#status-select-cajon", function () {
            self.toggleExtraFields(this.value);
          });
        return true;
      },
      render: function () {
        console.log("RENDER ejecutado");
        self.render_template({
          caption: {
            class_name: 'widget-caption',
            html: 'Widget de Subetapas'
          },
          body: `
            <style>
              /* Estilos generales */
              #select-container-cajon {
                background-color: #2F2662;
                display: flex;
                padding: 23px;
                border: 1px solid;
                border-radius: 15px;
                max-width: 400px;
                margin-left: 11px;
                margin-top: 15px;
                color: white;
                flex-direction: column;
              }

              /* Botón */
              #guardarCambios-cajon {
                padding: 10px 20px;
                color: white;
                border: none;
                border-radius: 5px;
                cursor: pointer;
                font-size: 16px;
                margin-top: 10px;
                background: #04AA6D;
              }
              #guardarCambios-cajon:hover {
                background: #46a049;
              }

              /*Sub Etapa*/
              #subEtapaWrapper-cajon {
                margin-top: 10px;
                display: flex;
                flex-direction: column;
                gap: 10px;
              }

              #status-select-cajon {
                width: 100%;
                margin-bottom: 10px;
                margin-top: 10px;
                border: 1px solid #ccc;
                border-radius: 5px;
                height: 100%;
                padding: 10px;
              }

              .form-group-cajon {
                margin-top: 15px;
              }
              
              #datetime-input, #client-message {
                padding: 12px;
                margin: 10px 0;
                border: 1px solid #ddd;
                border-radius: 6px;
                font-size: 16px;
                width: -webkit-fill-available;
              }
              
              .form-group-cajon label {
                font-weight: bold;
              }

            </style>

            <div id="select-container-cajon">
              <div class="form-group-cajon">
                <label for="status-select-cajon">Seleccionar Acción:</label>
                <select id="status-select-cajon">
                  <option value="standby">Recordatorio Aut.</option>
                  <option value="no_contesta">Seguimiento Aut.</option>
                </select>
              </div>

              <div id="extra-fields-container" style="display: none;">
                <div class="form-group-cajon">
                  <label for="datetime-input">Fecha y Hora:</label>
                  <input type="datetime-local" id="datetime-input">
                </div>
                <div class="form-group-cajon">
                  <label for="client-message">Mensaje al Cliente (opcional):</label>
                  <textarea id="client-message" rows="3"></textarea>
                </div>
              </div>

              <button id="guardarCambios-cajon" style="margin-top: 10px;">Ejecutar</button>

              <div id="snackbar"></div>
            </div>
          `,
          render: ''
        });

        self.toggleExtraFields($("#status-select-cajon").val());
        self.callbacks.bind_actions();
        return true;
      },
      onSave: function () { return true; },
      leads: {
        selected: function () { return true; },
      },
      destroy: function () {},
    };

    this.loadCSS = function () {
      var settings = self.get_settings();
      console.log("CSS loading from:", settings.path + "/style.css?v=" + settings.version);
      if (
        $(
          'link[href="' +
            settings.path +
            "/style.css?v=" +
            settings.version +
            '"]'
        ).length < 1
      ) {
        $("head").append(
          '<link href="' +
            settings.path +
            "/style.css?v=" +
            settings.version +
            '" type="text/css" rel="stylesheet">'
        );
      }
      $("head").append(
        "<style>\
        #snackbar {\
          visibility: hidden;\
          min-width: 250px;\
          margin-left: -125px;\
          background-color: #333;\
          color: #fff;\
          text-align: center;\
          border-radius: 2px;\
          padding: 16px;\
          position: fixed;\
          z-index: 1;\
          left: 50%;\
          bottom: 30px;\
          font-size: 17px;\
        }\
        #snackbar.show {\
          visibility: visible;\
          -webkit-animation: fadein 0.5s, fadeout 0.5s 2.5s;\
          animation: fadein 0.5s, fadeout 0.5s 2.5s;\
        }\
        @-webkit-keyframes fadein {\
          from {bottom: 0; opacity: 0;}\
          to {bottom: 30px; opacity: 1;}\
        }\
        @keyframes fadein {\
          from {bottom: 0; opacity: 0;}\
          to {bottom: 30px; opacity: 1;}\
        }\
        @-webkit-keyframes fadeout {\
          from {bottom: 30px; opacity: 1;}\
          to {bottom: 0; opacity: 0;}\
        }\
        @keyframes fadeout {\
          from {bottom: 30px; opacity: 1;}\
          to {bottom: 0; opacity: 0;}\
        }\
      </style>"
      );
    };

    this.showSnackbar = function (message) {
      var snackbar = $("#snackbar");
      snackbar.text(message);
      snackbar.addClass("show");
      setTimeout(function () {
        snackbar.removeClass("show");
      }, 3000);
    };

    this.saveData = function() {
      console.log("saveData fue llamada");

      if (!APP || !APP.data || !APP.data.current_card || !APP.data.current_card.id) {
        console.error("No se encontró el ID del lead");
        return;
      }

      const leadId = APP.data.current_card.id;
      const selectedStatus = $('#status-select-cajon').val();

      if (selectedStatus === "no_contesta") {
        const payload = {
          custom_fields_values: [
            {
              field_id: 498104, // ID de campo seguimiento
              values: [{ value: "0" }],
            },
            {
              field_id: 498154, // ID de campo ¿mensaje seguimiento?
              values: [{ value: false }],
            }, 
            {
              field_id: 498204, // ID de campo ¿No contesta?
              values: [{ value: true }],
            },                        
          ],
          _embedded: {
            tags: [
              { id: 33618 } // ID de la etiqueta "No contesta"
            ]
          }
        };

        $.ajax({
          url: `/api/v4/leads/${leadId}`,
          method: "PATCH",
          contentType: "application/json",
          data: JSON.stringify(payload),
          success: function () {
            console.log("Valores de No contesta actualizados con éxito");
            self.launchSalesbot('20500', leadId) //ejecutar bot espera seguimiento
            self.showSnackbar("Valores guardados");
          },
          error: function () {
            console.error("Error al actualizar valores de No contesta");
            self.showSnackbar("Error al guardar valores");
          },
        });

      } else if (selectedStatus === "standby") {
        
        const datetimeValue = $("#datetime-input").val();

        // Validación de fecha obligatoria
        if (!datetimeValue || datetimeValue.trim() === "") {
          self.showSnackbar("Error: La fecha y hora son obligatorias");
          return;
        }

        const date = new Date(datetimeValue);
        date.setSeconds(0);
        const timestamp = Math.floor(date.getTime() / 1000);

        // El mensaje del cliente es opcional
        const clientMessage = $("#client-message").val();

        const payload = {
          custom_fields_values: [
            {
              field_id: 498302, // ID de campo para fecha y hora recordatorio
              values: [{ value: timestamp }],
            },
            {
              field_id: 504122, // ID para campo con timestamp + 1 hora
              values: [{ value: timestamp + 3600 }], // Añade 3600 segundos (1 hora)
            },
          ],
          _embedded: {
            tags: [
              { id: 33610 } // ID de la etiqueta "Standby"
            ]
          }
        };

        // Solo agregar el campo de mensaje si el usuario ingresó algo
        if (clientMessage && clientMessage.trim() !== "") {
          payload.custom_fields_values.push({
            field_id: 498352, // ID de campo para el mensaje recordatorio
            values: [{ value: clientMessage }],
          });
        }

        $.ajax({
          url: `/api/v4/leads/${leadId}`,
          method: "PATCH",
          contentType: "application/json",
          data: JSON.stringify(payload),
          success: function () {
            console.log("Valores de Stand by actualizados con éxito");
            self.showSnackbar("Valores guardados correctamente");
          },
          error: function (xhr, status, error) {
            console.error("Error al actualizar valores de Stand by:", error);
            self.showSnackbar("Error al guardar valores");
          },
        });
      }
    }

    this.toggleExtraFields = function (selectedId) {
      const container = document.getElementById("extra-fields-container");
      if (selectedId === "standby") {
        container.style.display = "block";
      } else {
        container.style.display = "none";

        $("#datetime-input").val("");
        $("#client-message").val("");
      }
    };

    this.launchSalesbot = function (idBot, idLead) {
      const payload = JSON.stringify([
        {
          bot_id: idBot,
          entity_type: 2, // 2 = lead
          entity_id: idLead
        }
      ]);
    
      $.ajax({
        url: '/api/v2/salesbot/run',
        method: 'POST',
        contentType: 'application/json',
        data: payload,
        success: function(data) {
          console.log("Salesbot lanzado con éxito:", data);
          self.showSnackbar("Salesbot lanzado");
        },
        error: function(xhr, status, error) {
          console.error("Error al lanzar Salesbot:", error);
          self.showSnackbar("Error al lanzar Salesbot");
        }
      });
    };
    return this;
  };


  return CustomWidget;
});
