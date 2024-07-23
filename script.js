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
          self.calculateAndSend();
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
                   <button id="calculate-btn">Calculate</button>\
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

    this.calculateAndSend = function () {
      var leadData = APP.data.current_card;
      var attributes = leadData.fields_hider.model.attributes;

      if (!leadData || !attributes) {
        self.showError('Lead data or attributes are undefined');
        return;
      }

      var meses = parseInt(attributes['CFV[2959884]'] || '0', 10);
      var usuarios = parseInt(attributes['CFV[2959886]'] || '0', 10);
      var planKommo = attributes['CFV[2959888]'] || '';

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
    
    // Continuar con el flujo normal si todos los campos están completos
      console.log('Meses:', meses);
      console.log('Usuarios:', usuarios);
      console.log('Plan Kommo:', planKommo);  

      var planValue;
      switch (planKommo) {
        case "9227454": // Básico
          planValue = 10;
          break;
        case "9227456": // Avanzado
          planValue = 15;
          break;
        case "9227458": // Empresarial
          planValue = 30;
          break;
        default:
          console.log('Unexpected planKommo value:', planKommo);
          planValue = 0;
      }

      console.log('Plan Value:', planValue);

      var result = meses * usuarios * planValue;

      if (isNaN(result) || result <= 0) {
        self.showError('Calculation result is invalid.');
        return;
      }

      // Guardar el resultado en una variable para usarlo en el webhook
      self.calculationResult = result;

      // Mostrar el resultado en la pantalla
      var displayDiv = $('#calculation-result');
      displayDiv.empty();
      displayDiv.append('<p>Calculation Result: ' + result + '</p>');

      // Enviar los datos al webhook
      self.sendWebhook(result);
    };

    this.sendWebhook = function(result) {
      var webhookUrl = 'https://script.google.com/macros/s/AKfycbzxaH99Y9u4FrBYJCBgTn2zgbgSCT_w7BHGZlMc0hHMkSW_MA8VGaMlKsclVCFY6IP7GA/exec';

      var payload = {
        id: APP.data.current_card.id,
        price: parseInt(result, 10)  // Asegurarse de que price es un entero
      };

      self.crm_post(
        webhookUrl,
        payload,
        function(msg) {
          console.log('Webhook sent successfully:', msg);
          self.showSnackbar('Valor correctamente enviado');
        },
        'json',
        function(error) {
          console.error('Error sending webhook:', error);
          self.showSnackbar('Error sending webhook: ' + error);
        }
      );
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
