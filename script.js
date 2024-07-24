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
          self.fetchLeadData();
        });
        return true;
      },
      render: function () {
        self.render_template({
          caption: {
            class_name: 'js-km-caption',
            html: 'Lead Data Calculator'
          },
          body: '<div class="km-form">\
                   <button id="calculate-btn">Calcular</button>\
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

    this.fetchLeadData = function () {
      var leadId = APP.data.current_card.id; // Obtiene el ID del lead actual

      $.ajax({
        url: '/api/v4/leads/' + leadId, // Endpoint de la API de Kommo para obtener los datos de un lead específico
        method: 'GET',
        dataType: 'json',
        success: function(data) {
          console.log('Lead data:', data);
          self.calculateAndDisplay(data);
        },
        error: function(error) {
          console.error('Error fetching lead data:', error);
          self.showSnackbar('Error fetching lead data: ' + error.statusText);
        }
      });
    };

    this.calculateAndDisplay = function(leadData) {
      // Extraer los valores de los campos personalizados
      var customFields = leadData.custom_fields_values;
      var attributes = {};
      customFields.forEach(function(field) {
        attributes[field.field_id] = field.values[0].value;
      });

      var meses = parseInt(attributes['2959884'] || '0', 10);
      var usuarios = parseInt(attributes['2959886'] || '0', 10);
      var planKommo = attributes['2959888'] || '';

      if (meses === 0) {
        self.showSnackbar('Por favor, complete el campo de meses');
        return;
      }
    
      if (usuarios === 0) {
        self.showSnackbar('Por favor, complete el campo de usuarios');
        return;
      }
    
      if (planKommo === '') {
        self.showSnackbar('Por favor, complete el campo de plan Kommo');
        return;
      }

      // Determinar el valor del plan Kommo basado en value
      var planValue;
      switch (planKommo) {
        case "Básico":
          planValue = 10;
          break;
        case "Avanzado":
          planValue = 15;
          break;
        case "Empresarial":
          planValue = 30;
          break;
        default:
          console.log('Unexpected planKommo value:', planKommo);
          planValue = 0;
      }

      var result = meses * usuarios * planValue;

      if (isNaN(result) || result <= 0) {
        self.showError('Calculo inválido');
        return;
      }

      // Mostrar el resultado en la pantalla
      var displayDiv = $('#calculation-result');
      displayDiv.empty();
      displayDiv.append('<p>Calculation Result: ' + result + '</p>');

      self.showSnackbar('Calculo realizado con éxito');

      // Actualizar el campo price del lead
      self.updateLeadPrice(leadData.id, result);
    };

    this.updateLeadPrice = function(leadId, price) {
      var leadData = {
        price: price
      };

      $.ajax({
        url: '/api/v4/leads/' + leadId,
        method: 'PATCH',
        contentType: 'application/json',
        data: JSON.stringify(leadData),
        success: function(response) {
          console.log('Lead price updated:', response);
          self.showSnackbar('presupuesto actualizado con éxito');
        },
        error: function(error) {
          console.error('Error updating lead price:', error);
          self.showSnackbar('Error updating lead price: ' + error.statusText);
        }
      });
    };

    this.showError = function(message) {
      alert(message);
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
