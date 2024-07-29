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
        $(document).off('click', '#save-btn').on('click', '#save-btn', function () {
          self.calculate();
          self.saveData();
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
                   <div>\
                     <label for="meses">Meses:</label>\
                     <input type="number" id="meses" value="0" min="0">\
                   </div>\
                   <div>\
                     <label for="usuarios">Usuarios:</label>\
                     <input type="number" id="usuarios" value="0" min="0">\
                   </div>\
                   <div>\
                     <label for="plan-kommo">Plan Kommo:</label>\
                     <select id="plan-kommo">\
                       <option value="" selected disabled>Seleccionar plan</option>\
                       <option value="Básico">Básico</option>\
                       <option value="Avanzado">Avanzado</option>\
                       <option value="Empresarial">Empresarial</option>\
                     </select>\
                   </div>\
                   <div class="button-container">\
                     <button id="calculate-btn">Calcular</button>\
                     <button id="save-btn">Guardar</button>\
                   </div>\
                   <div id="calculation-result"></div>\
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
      var leadId = APP.data.current_card.id;

      $.ajax({
        url: '/api/v4/leads/' + leadId,
        method: 'GET',
        dataType: 'json',
        success: function(data) {
          console.log('Lead data:', data);
          self.populateForm(data);
        },
        error: function(error) {
          console.error('Error fetching lead data:', error);
          self.showSnackbar('Error fetching lead data: ' + error.statusText);
        }
      });
    };

    this.populateForm = function(leadData) {
      var customFields = leadData.custom_fields_values;
      var attributes = {};
      customFields.forEach(function(field) {
        attributes[field.field_id] = field.values[0].value;
      });

      $('#meses').val(attributes['794456'] || '0');
      $('#usuarios').val(attributes['794454'] || '0');
      $('#plan-kommo').val(attributes['794639'] || '');
    };

    this.calculate = function() {
      var meses = parseInt($('#meses').val() || '0', 10);
      var usuarios = parseInt($('#usuarios').val() || '0', 10);
      var planKommo = $('#plan-kommo').val() || '';

      if (meses === 0 || usuarios === 0 || planKommo === '') {
        self.showSnackbar('Por favor, complete todos los campos y seleccione un plan.');
        return;
      }

      var planValue;
      switch (planKommo) {
        case "Básico":
          planValue = 15;
          break;
        case "Avanzado":
          planValue = 25;
          break;
        case "Empresarial":
          planValue = 45;
          break;
        default:
          console.log('Unexpected planKommo value:', planKommo);
          planValue = 0;
      }

      var result = meses * usuarios * planValue;

      if (isNaN(result) || result <= 0) {
        self.showSnackbar('El resultado del cálculo no es válido.');
        return;
      }

      $('#calculation-result').text('Resultado $' + result);
    };

    this.saveData = function() {
      var leadId = APP.data.current_card.id;
      var meses = $('#meses').val().toString();
      var usuarios = $('#usuarios').val().toString();
      var planKommo = $('#plan-kommo').val();
      var priceText = $('#calculation-result').text().split('$')[1]; // Corrige la extracción del valor
      var price = parseFloat(priceText);
    
      if (!price || isNaN(price)) {
        self.showSnackbar('Primero realice el cálculo para guardar el precio.');
        return;
      }
    
      if (!planKommo) {
        self.showSnackbar('Por favor, seleccione un plan Kommo.');
        return;
      }
    
      // Construir los datos a enviar al lead
      var customFields = [
        { field_id: 794456, values: [{ value: meses }] },
        { field_id: 794454, values: [{ value: usuarios }] },
        { field_id: 794639, values: [{ value: planKommo }] },
        { field_id: 794643, values: [{ value: price }] }
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
          self.showSnackbar('Los datos del lead se han actualizado con éxito.');
        },
        error: function(error) {
          console.error('Error updating lead data:', error);
          self.showSnackbar('Error al actualizar los datos del lead: ' + error.statusText);
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
