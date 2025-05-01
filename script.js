define(['jquery'], function ($) {
  var CustomWidget = function () {
    var self = this;

    this.callbacks = {
      settings: function () {
        console.log('Callback: settings');
        return true;
      },
      init: function () {
        console.log('Callback: init');
        self.loadCSS();
        return true;
      },
      bind_actions: function () {
        console.log('Callback: bind_actions');
        $(document).off('click', '#save-lead-btn').on('click', '#save-lead-btn', function () {
          console.log('Save button clicked');
          self.saveLeadData();
        });
        return true;
      },
      render: function () {
        console.log('Callback: render');
        self.render_template({
          caption: {
            class_name: 'js-km-caption',
            html: 'Actualizar Lead'
          },
          body: `
            <div class="km-form">
              <div class="form-group">
                <label class="checkbox-label">
                  <input type="checkbox" id="standby-checkbox"> 
                  <span>Mover a Stand By</span>
                </label>
              </div>
              <div class="form-group">
                <label for="datetime-input">Fecha y Hora:</label>
                <input type="datetime-local" id="datetime-input">
              </div>
              <div class="form-group">
                <label for="client-message">Mensaje al Cliente (opcional):</label>
                <textarea id="client-message" rows="3"></textarea>
              </div>
              <div class="button-container">
                <button id="save-lead-btn">Guardar</button>
              </div>
              <div id="snackbar"></div>
            </div>
          `,
          render: ''
        });
        return true;
      },
      onSave: function () {
        console.log('Callback: onSave');
        return true;
      },
      leads: {
        selected: function () {
          console.log('Callback: leads.selected');
          return true;
        }
      },
      destroy: function () {
        console.log('Callback: destroy');
      }
    };

    this.loadCSS = function () {
      var settings = self.get_settings();
      if ($('link[href="' + settings.path + '/style.css?v=' + settings.version + '"').length < 1) {
        $('head').append('<link href="' + settings.path + '/style.css?v=' + settings.version + '" type="text/css" rel="stylesheet">');
      }
      $('head').append('<style>\
        #snackbar {\
          visibility: hidden;\
          min-width: 300px;\
          margin-left: -150px;\
          background-color: #323232;\
          color: #fff;\
          text-align: center;\
          border-radius: 8px;\
          padding: 16px;\
          position: fixed;\
          z-index: 1;\
          left: 50%;\
          bottom: 30px;\
          font-size: 16px;\
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);\
          transition: visibility 0.3s, opacity 0.3s ease-in-out;\
          opacity: 0;\
        }\
        #snackbar.show {\
          visibility: visible;\
          opacity: 1;\
          animation: fadein 0.5s, fadeout 0.5s 2.5s;\
        }\
        input, textarea {\
          padding: 12px;\
          margin: 10px 0;\
          box-sizing: border-box;\
          border: 1px solid #ddd;\
          border-radius: 6px;\
          font-size: 16px;\
          transition: border-color 0.3s, box-shadow 0.3s;\
        }\
        input:focus, textarea:focus {\
          border-color: #4CAF50;\
          box-shadow: 0 0 5px rgba(76, 175, 80, 0.5);\
          outline: none;\
        }\
        button {\
          background-color: #4CAF50;\
          color: white;\
          padding: 12px 20px;\
          border: none;\
          border-radius: 6px;\
          cursor: pointer;\
          font-size: 16px;\
          transition: background-color 0.3s, transform 0.2s;\
        }\
        button:hover {\
          background-color: #45a049;\
          transform: scale(1.05);\
        }\
        .km-form {\
          max-width: 400px;\
          padding: 20px;\
          border-radius: 8px;\
          box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);\
        }\
        .form-group {\
          margin-bottom: 15px;\
        }\
        label {\
          font-size: 14px;\
          font-weight: bold;\
          margin-bottom: 5px;\
          display: block;\
        }\
        .checkbox-label {\
          display: flex;\
          align-items: center;\
          gap: 8px;\
          font-size: 14px;\
          font-weight: normal;\
        }\
        @keyframes fadein {\
          from { opacity: 0; }\
          to { opacity: 1; }\
        }\
        @keyframes fadeout {\
          from { opacity: 1; }\
          to { opacity: 0; }\
        }\
      </style>');
    };

    this.saveLeadData = function () {
      console.log('saveLeadData called');
      var moveToStandBy = $('#standby-checkbox').is(':checked');
      console.log('Move to Stand By:', moveToStandBy);

      if (!moveToStandBy) {
        console.log('Checkbox not selected');
        self.showSnackbar('El checkbox no está seleccionado. No se realizó ninguna acción.');
        return;
      }

      var datetimeValue = $('#datetime-input').val();
      console.log('Datetime value:', datetimeValue);

      if (!datetimeValue) {
        console.log('Datetime value is empty');
        self.showSnackbar('Por favor, ingrese una fecha y hora.');
        return;
      }

      var date = new Date(datetimeValue);
      var minutes = date.getMinutes();
      var roundedMinutes = Math.round(minutes / 15) * 15;
      date.setMinutes(roundedMinutes);
      date.setSeconds(0);

      // Convertir a Unix Timestamp
      var timestamp = Math.floor(date.getTime() / 1000);
      console.log('Rounded timestamp (Unix):', timestamp);

      var leadId = APP.data.current_card.id;
      console.log('Lead ID:', leadId);

      var clientMessage = $('#client-message').val();
      console.log('Client message:', clientMessage);

      var customFields = [
        { field_id: 1982077, values: [{ value: timestamp }] }
      ];

      if (clientMessage) {
        customFields.push({ field_id: 1982071, values: [{ value: clientMessage }] });
      }

      var leadData = {
        id: leadId,
        status_id: 84787844,
        custom_fields_values: customFields
      };
      console.log('Lead data to send:', leadData);

      $.ajax({
        url: '/api/v4/leads/' + leadId,
        method: 'PATCH',
        contentType: 'application/json',
        data: JSON.stringify(leadData),
        success: function (response) {
          console.log('Lead data updated:', response);
          self.showSnackbar('Los datos del lead se han actualizado con éxito.');
        },
        error: function (error) {
          console.error('Error updating lead data:', error);
          self.showSnackbar('Error al actualizar los datos del lead: ' + error.statusText);
        }
      });
    };

    this.showSnackbar = function (message) {
      console.log('Showing snackbar with message:', message);
      var snackbar = $('#snackbar');
      snackbar.text(message);
      snackbar.addClass('show');
      setTimeout(function () {
        snackbar.removeClass('show');
      }, 3000);
    };

    return this;
  };
  return CustomWidget;
});