define(['jquery'], function ($) {
  var CustomWidget = function () {
    var self = this;

    this.callbacks = {
      settings: function () {
        return true;
      },
      init: function () {
        self.loadCSS();
        return true;
      },
      bind_actions: function () {
        $(document).off('click', '#calculate-btn').on('click', '#calculate-btn', function () {
          self.calculate();
        });
        return true;
      },
      render: function () {
        self.render_template({
          caption: {
            class_name: 'js-km-caption',
            html: ''
          },
          body: '<div class="km-form">\
                   <h3>Calculadora: Valor Encuentro</h3>\
                   <div class="button-container">\
                     <button id="calculate-btn">Calcular Total</button>\
                   </div>\
                   <div id="calculation-result"></div>\
                 </div>\
                 <div id="snackbar"></div>',
          render: ''
        });
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

    this.calculate = function() {
      var leadId = APP.data.current_card.id;

      $.ajax({
        url: '/api/v4/leads/' + leadId,
        method: 'GET',
        dataType: 'json',
        success: function(data) {
          console.log('Lead data:', data);
          var fields = [1144348, 1144354, 1144356, 1147161, 1147163, 1147165];
          var sum = 0;

          fields.forEach(function(field_id) {
            var field = data.custom_fields_values.find(f => f.field_id === field_id);
            var value = field && field.values.length > 0 ? parseInt(field.values[0].value, 10) : 0;
            sum += value;
          });

          var resultField = 1146883;
          var remainingField = 1146885;

          var customField1143754 = data.custom_fields_values.find(f => f.field_id === 1143754);
          var customFieldValue = customField1143754 && customField1143754.values.length > 0 ? customField1143754.values[0].value : '';
          var baseValue = customFieldValue === "Matrimonios" ? 180 : 90;

          var remaining = baseValue - sum;

          if (remaining < 0) {
            $('#calculation-result').text('Resultado: ' + sum + ', Restante: ' + remaining);
            self.showSnackbar('Verifique los campos de pago. La resta resultó en un valor negativo.');
            return;
          }

          self.updateField(resultField, sum);
          self.updateField(remainingField, remaining);

          $('#calculation-result').text('Resultado: ' + sum + ', Restante: ' + remaining);
        },
        error: function(error) {
          console.error('Error fetching lead data:', error);
          self.showSnackbar('Error fetching lead data: ' + error.statusText);
        }
      });
    };

    this.updateField = function(fieldId, value) {
      var leadId = APP.data.current_card.id;

      var leadData = {
        custom_fields_values: [{
          field_id: fieldId,
          values: [{ value: value }]
        }]
      };

      $.ajax({
        url: '/api/v4/leads/' + leadId,
        method: 'PATCH',
        contentType: 'application/json',
        data: JSON.stringify(leadData),
        success: function(response) {
          console.log('Campo actualizado:', response);
          self.showSnackbar('El cálculo se ha guardado correctamente.');
        },
        error: function(error) {
          console.error('Error al actualizar el campo:', error);
          self.showSnackbar('Error al guardar los datos: ' + error.statusText);
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

    return this;
  };
  return CustomWidget;
});
