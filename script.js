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
        $(document).off('click', '#post-address-btn').on('click', '#post-address-btn', function () {
          self.postAddress();
        });
        return true;
      },
      render: function () {
        self.render_template({
          caption: {
            class_name: 'js-km-caption',
            html: 'Postear Dirección'
          },
          body: '<div class="km-form">\
                   <div class="button-container">\
                     <button id="post-address-btn">Postear Dirección</button>\
                   </div>\
                   <div id="address-result"></div>\
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

    this.postAddress = function() {
      var widgetHTML = APP.data.card_page.$widgets_block[0].innerHTML;
      var addressRegex = /<span class="ui-text ui-text--m ui-text--gray tj5uZWn8gy_AUYr71B77J">([^<]+)<\/span>/g;
      var matches = widgetHTML.match(addressRegex);
      if (matches) {
        var address = matches.map(function(match) {
          return match.replace(/<[^>]+>/g, '').trim();
        }).join(', ');
        $('#address-result').text('Dirección: ' + address);
        self.showSnackbar('Dirección extraída con éxito.');
        self.saveAddressToKommo(address);
      } else {
        self.showSnackbar('No se pudo extraer la dirección.');
      }
    };

    this.saveAddressToKommo = function(address) {
      var leadId = APP.data.current_card.id;

      var customFields = [
        { field_id: 321852, values: [{ value: address }] } 
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
          self.showSnackbar('La dirección se ha actualizado con éxito en Kommo.');
          // Ejecutar el bot con ID 11474
          $.ajax({
            url: '/api/v2/salesbot/run',
            method: 'POST',
            contentType: 'application/json',
            data: JSON.stringify([{ bot_id: 11474, entity_id: leadId, entity_type: '2' }]),
            success: function(botResponse) {
              console.log('Bot ejecutado con éxito:', botResponse);
              self.showSnackbar('El bot se ha ejecutado con éxito.');
            },
            error: function(botError) {
              console.error('Error al ejecutar el bot:', botError);
              self.showSnackbar('Error al ejecutar el bot: ' + botError.statusText);
            }
          });
        },
        error: function(error) {
          console.error('Error updating lead data:', error);
          self.showSnackbar('Error al actualizar la dirección en Kommo: ' + error.statusText);
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