define(['jquery', 'store', 'underscore'], function ($, store, _) {
  var CustomWidget = function () {
    var self = this;
    var incrementInterval;
    var leadIdKey = 'incrementingLeadId';
    var remainingIncrementsKey = 'remainingIncrements';

    // Comprobar si el objeto APP.holos existe, y si no, crearlo
    if (!APP.holos) {
      console.log('Creando objeto APP.holos');
      APP.holos = {
        incrementInterval: null,
        startIncrementingCounter: function (leadId, times) {
          console.log('Iniciando incremento del contador para Lead ID:', leadId, 'con', times, 'incrementos restantes');
          store.set(leadIdKey, leadId);
          store.set(remainingIncrementsKey, times);

          this.incrementInterval = setInterval(function () {
            self.incrementCounter(leadId, function (success) {
              if (!success || --times <= 0) {
                APP.holos.stopIncrementingCounter();
              } else {
                store.set(remainingIncrementsKey, times);
              }
            });
          }, 1000);
        },
        stopIncrementingCounter: function () {
          console.log('Deteniendo incremento del contador');
          clearInterval(this.incrementInterval);
          store.remove(leadIdKey);
          store.remove(remainingIncrementsKey);
          this.incrementInterval = null;
        }
      };
    } else {
      console.log('Objeto APP.holos ya existe');
    }

    this.callbacks = {
      settings: function () {
        return true;
      },
      init: function () {
        console.log('Inicializando widget');
        self.loadCSS();
        self.checkIncrementingStatus();
        return true;
      },
      bind_actions: function () {
        console.log('Vinculando acciones del widget');
        $(document).off('click', '#increment-btn').on('click', '#increment-btn', function () {
          var leadId = APP.data.current_card.id;
          var remainingIncrements = 30;
          console.log('Botón Incrementar presionado. Iniciando contador para Lead ID:', leadId);
          APP.holos.startIncrementingCounter(leadId, remainingIncrements);
        });

        $(document).off('click', '#stop-btn').on('click', '#stop-btn', function () {
          console.log('Botón Detener presionado. Deteniendo contador');
          APP.holos.stopIncrementingCounter();
        });

        return true;
      },
      render: function () {
        console.log('Renderizando widget');
        self.render_template({
          caption: {
            class_name: 'js-km-caption',
            html: 'Lead Counter Incrementer'
          },
          body: '<div class="km-form">\
                   <div>\
                     <label for="counter">Contador:</label>\
                     <input type="number" id="counter" value="0" readonly>\
                   </div>\
                   <div class="button-container">\
                     <button id="increment-btn">Incrementar</button>\
                     <button id="stop-btn">Detener</button>\
                   </div>\
                 </div>\
                 <div id="snackbar"></div>',
          render: ''
        });
        self.fetchLeadData();
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
      destroy: function () {
        console.log('Destruyendo widget');
        if (APP.holos.incrementInterval) {
          APP.holos.stopIncrementingCounter();
        }
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
      </style>');
    };

    this.fetchLeadData = function () {
      var leadId = APP.data.current_card.id;
      console.log('Obteniendo datos del Lead ID:', leadId);

      $.ajax({
        url: '/api/v4/leads/' + leadId,
        method: 'GET',
        dataType: 'json',
        success: function (data) {
          console.log('Datos del Lead obtenidos:', data);
          self.populateCounter(data);
        },
        error: function (error) {
          console.error('Error al obtener datos del Lead:', error);
          self.showSnackbar('Error fetching lead data: ' + error.statusText);
        }
      });
    };

    this.populateCounter = function (leadData) {
      var customFields = leadData.custom_fields_values;
      var counterValue = 0;
      customFields.forEach(function (field) {
        if (field.field_id == 2960328) {
          counterValue = parseInt(field.values[0].value, 10) || 0;
        }
      });
      $('#counter').val(counterValue);
    };

    this.incrementCounter = function (leadId, callback) {
      var currentCounter = parseInt($('#counter').val(), 10);
      var newCounter = currentCounter + 1;

      var customFields = [
        { field_id: 2960328, values: [{ value: newCounter }] }
      ];

      var leadData = {
        custom_fields_values: customFields
      };

      $.ajax({
        url: '/api/v4/leads/' + leadId,
        method: 'PATCH',
        contentType: 'application/json',
        data: JSON.stringify(leadData),
        success: function (response) {
          console.log('Datos del Lead actualizados:', response);
          $('#counter').val(newCounter);
          self.showSnackbar('El contador se ha incrementado con éxito.');
          if (newCounter >= 30) {
            APP.holos.stopIncrementingCounter();
          }
          callback(true);
        },
        error: function (error) {
          console.error('Error al actualizar los datos del Lead:', error);
          self.showSnackbar('Error al actualizar el contador: ' + error.statusText);
          callback(false);
        }
      });
    };

    this.showSnackbar = function (message) {
      var snackbar = $('#snackbar');
      snackbar.text(message);
      snackbar.addClass('show');
      setTimeout(function () {
        snackbar.removeClass('show');
      }, 3000);
    };

    this.checkIncrementingStatus = function () {
      var leadId = store.get(leadIdKey);
      var remainingIncrements = parseInt(store.get(remainingIncrementsKey), 10);

      if (leadId && remainingIncrements > 0) {
        console.log('Reanudando incremento del contador para Lead ID:', leadId, 'con', remainingIncrements, 'incrementos restantes');
        APP.holos.startIncrementingCounter(leadId, remainingIncrements);
      } else {
        console.log('No hay incremento del contador en curso');
      }
    };

    return this;
  };
  return CustomWidget;
});
