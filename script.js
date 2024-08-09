define(['jquery', 'underscore'], function ($, _) {
  var CustomWidget = function () {
    var self = this;
    var isUpdating = false; // Variable para evitar bucles infinitos

    this.callbacks = {
      settings: function () {
        return true;
      },
      init: function () {
        self.loadCSS();
        return true;
      },
      bind_actions: function () {
        // Añadir evento click para el botón de cálculo
        $(document).on('click', '#calculate-button', function () {
          self.calculateAndUpdate();
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
                     <label for="valor1">Valor 1:</label>\
                     <input type="number" id="valor1" value="0" min="0">\
                   </div>\
                   <div>\
                     <label for="valor2">Valor 2:</label>\
                     <input type="number" id="valor2" value="0" min="0">\
                   </div>\
                   <div id="calculation-result">Resultado: 0</div>\
                   <button id="calculate-button">Calcular</button>',
          render: ''
        });
        self.fetchLeadData();
        return true;
      },
      loadPreloadedData: function () {
        // Este método se llama cuando se inicializa la pestaña del widget
        return Promise.resolve({
          data: 'Datos precargados si es necesario'
        });
      },
      loadElements: function (type, id) {
        // Este método se llama para cargar elementos vinculados a la tarjeta
        return Promise.resolve({
          elements: []  // Aquí podrías devolver una lista de elementos si fuera necesario
        });
      },
      onSave: function () {
        return true;
      },
      leads: {
        selected: function () {
          self.fetchLeadData();
          return true;
        }
      },
      destroy: function () {}
    };

    this.loadCSS = function () {
      var settings = self.get_settings();
      if ($('link[href="' + settings.path + '/style.css?v=' + settings.version + '"').length < 1) {
        $('head').append('<link href="' + settings.path + '/style.css?v=' + settings.version + '" type="text/css" rel="stylesheet">');
      }
    };

    this.fetchLeadData = function () {
      var leadId = APP.data.current_card.id;

      $.ajax({
        url: '/api/v4/leads/' + leadId,
        method: 'GET',
        dataType: 'json',
        success: function (data) {
          self.populateForm(data);
        },
        error: function (error) {
          console.error('Error fetching lead data:', error);
        }
      });
    };

    this.populateForm = function (leadData) {
      var customFields = leadData.custom_fields_values;
      var attributes = {};
      customFields.forEach(function (field) {
        attributes[field.field_id] = field.values[0].value;
      });

      var valor1 = attributes['2960406'] || '0';
      var valor2 = attributes['2960408'] || '0';

      $('#valor1').val(valor1);
      $('#valor2').val(valor2);
    };

    this.calculateAndUpdate = function () {
      var valor1 = parseInt($('#valor1').val() || '0', 10);
      var valor2 = parseInt($('#valor2').val() || '0', 10);
      var result = valor1 + valor2;

      $('#calculation-result').text('Resultado: ' + result);
      self.updateFields(valor1, valor2, result);
    };

    this.updateFields = function (valor1, valor2, result) {
      var leadId = APP.data.current_card.id;
      var customFields = [
        { field_id: 2960406, values: [{ value: valor1 }] },
        { field_id: 2960408, values: [{ value: valor2 }] },
        { field_id: 2960410, values: [{ value: result }] }
      ];

      var leadData = {
        custom_fields_values: customFields
      };

      if (!isUpdating) {
        isUpdating = true; // Marcar como actualización en progreso para evitar bucles infinitos

        $.ajax({
          url: '/api/v4/leads/' + leadId,
          method: 'PATCH',
          contentType: 'application/json',
          data: JSON.stringify(leadData),
          success: function (response) {
            console.log('Lead data updated:', response);
            isUpdating = false; // Desmarcar después de la actualización
          },
          error: function (error) {
            console.error('Error updating lead data:', error);
            isUpdating = false; // Desmarcar en caso de error
          }
        });
      }
    };

    return this;
  };
  return CustomWidget;
});
