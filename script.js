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
        // Bind the click event to the button for fetching lead data
        $('.js-fetch-lead-data').on('click', function () {
          self.fetchLeadData();
        });
        return true;
      },
      render: function () {
        self.render_template({
          caption: {
            class_name: 'js-km-caption',
            html: 'Lead Data Fetcher'
          },
          body: '<div class="lead-data-container">\
                   <button class="js-fetch-lead-data">Fetch Lead Data</button>\
                 </div>',
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
      var cssFilePath = settings.path + '/style.css?v=' + settings.version;
      if ($('link[href="' + cssFilePath + '"]').length < 1) {
        $('head').append('<link href="' + cssFilePath + '" type="text/css" rel="stylesheet">');
      }
    };

    this.fetchLeadData = function() {
      var leadId = APP.data.current_card.id; // Obtiene el ID del lead actual

      $.ajax({
        url: '/api/v4/leads/' + leadId, // Endpoint de la API de Kommo para obtener los datos de un lead específico
        method: 'GET',
        dataType: 'json',
        success: function(data) {
          console.log('Lead data:', data);
          // Procesar y mostrar los datos del lead como desees
        },
        error: function(error) {
          console.error('Error fetching lead data:', error);
        }
      });
    };

    return this;
  };
  return CustomWidget;
});
