define(['jquery'], function ($) {
  var CustomWidget = function () {
    var self = this;
    var incrementInterval;

    this.callbacks = {
      settings: function () {
        return true;
      },
      init: function () {
        self.loadCSS();
        return true;
      },
      bind_actions: function () {
        $(document).off('click', '#increment-btn').on('click', '#increment-btn', function () {
          self.startIncrementingCounter(30);
        });
        return true;
      },
      render: function () {
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
        if (incrementInterval) {
          clearInterval(incrementInterval);
        }
      }
    };

    this.loadCSS = function() {
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

      $.ajax({
        url: '/api/v4/leads/' + leadId,
        method: 'GET',
        dataType: 'json',
        success: function(data) {
          console.log('Lead data:', data);
          self.populateCounter(data);
        },
        error: function(error) {
          console.error('Error fetching lead data:', error);
          self.showSnackbar('Error fetching lead data: ' + error.statusText);
        }
      });
    };

    this.populateCounter = function(leadData) {
      var customFields = leadData.custom_fields_values;
      var counterValue = 0;
      customFields.forEach(function(field) {
        if (field.field_id == 2960328) {
          counterValue = parseInt(field.values[0].value, 10) || 0;
        }
      });
      $('#counter').val(counterValue);
    };

    this.startIncrementingCounter = function(times) {
      var leadId = APP.data.current_card.id;

      incrementInterval = setInterval(function() {
        self.incrementCounter(leadId, function(success) {
          if (!success || --times <= 0) {
            clearInterval(incrementInterval);
          }
        });
      }, 1000);
      
      // Guardar el estado en localStorage para continuar después
      localStorage.setItem('incrementingLeadId', leadId);
      localStorage.setItem('remainingIncrements', times);
    };

    this.incrementCounter = function(leadId, callback) {
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
        success: function(response) {
          console.log('Lead data updated:', response);
          $('#counter').val(newCounter);
          self.showSnackbar('El contador se ha incrementado con éxito.');
          callback(true);
        },
        error: function(error) {
          console.error('Error updating lead data:', error);
          self.showSnackbar('Error al actualizar el contador: ' + error.statusText);
          callback(false);
        }
      });
    };

    this.showSnackbar = function(message) {
      var snackbar = $('#snackbar');
      snackbar.text(message);
      snackbar.addClass('show');
      setTimeout(function() {
        snackbar.removeClass('show');
      }, 3000);
    };

    // Al iniciar el widget, verificar si hay un incremento en curso
    $(document).ready(function() {
      var leadId = localStorage.getItem('incrementingLeadId');
      var remainingIncrements = parseInt(localStorage.getItem('remainingIncrements'), 10);

      if (leadId && remainingIncrements > 0) {
        self.startIncrementingCounter(remainingIncrements);
      }
    });

    return this;
  };
  return CustomWidget;
});
