define(['jquery'], function ($) {
  var CustomWidget = function () {
      var self = this;

      this.callbacks = {
          settings: function () {
              var $modal_body = $('.modal.' + self.get_settings().widget_code + ' .modal-body'),
                  $widget_settings = $modal_body.find('.widget_settings_block');

              // Obtener valores almacenados o establecer valores predeterminados
              var customValue1 = self.get_settings().custom_value_1 || 180;
              var customValue2 = self.get_settings().custom_value_2 || 90;

              // Renderizar los campos de configuración
              $widget_settings.html(`
                  <div class="km-form">
                      <label for="custom_value_1">Valor para Matrimonios:</label>
                      <input type="number" id="custom_value_1" name="custom_value_1" value="${customValue1}" class="km-input">

                      <label for="custom_value_2">Valor para Otros Encuentros:</label>
                      <input type="number" id="custom_value_2" name="custom_value_2" value="${customValue2}" class="km-input">

                      <div class="button-container">
                          <button id="save-btn" type="button" class="km-button">Guardar</button>
                      </div>
                  </div>
              `);

              // Manejar el evento de clic del botón de guardar
              $widget_settings.find('#save-btn').on('click', function () {
                  var customValue1 = parseInt($('#custom_value_1').val(), 10);
                  var customValue2 = parseInt($('#custom_value_2').val(), 10);

                  if (isNaN(customValue1)) customValue1 = 180;
                  if (isNaN(customValue2)) customValue2 = 90;

                  // Guardar configuraciones
                  var updatedSettings = {
                      custom_value_1: customValue1,
                      custom_value_2: customValue2,
                  };

                  // Guardar las configuraciones usando la función de guardar del widget
                  self.save_settings(updatedSettings).then(function () {
                      console.log('Configuraciones guardadas:', updatedSettings);
                      alert('Configuraciones guardadas correctamente.');
                  }).catch(function (error) {
                      console.error('Error al guardar configuraciones:', error);
                      alert('Error al guardar configuraciones. Inténtalo de nuevo.');
                  });
              });

              // Aplicar estilos personalizados
              self.applyCustomStyles();

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
                  body: `
                  <div class="km-form">
                      <h3>Calculadora: Valor Encuentro</h3>
                      <div class="button-container">
                          <button id="calculate-btn" class="km-button">Calcular Total</button>
                      </div>
                      <div id="calculation-result"></div>
                  </div>
                  <div id="snackbar"></div>
                  `,
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

      this.loadCSS = function () {
          var settings = self.get_settings();
          if ($('link[href="' + settings.path + '/style.css?v=' + settings.version + '"').length < 1) {
              $('head').append('<link href="' + settings.path + '/style.css?v=' + settings.version + '" type="text/css" rel="stylesheet">');
          }
      };

      this.applyCustomStyles = function () {
          $('head').append(`
              <style>
                  .km-form {
                      padding: 15px;
                      background: #2F2662;
                      border: 1px solid #ddd;
                      border-radius: 5px;
                      max-width: 400px;
                      margin: 0 auto;
                  }
                  .km-form label {
                      color: #fff;
                      font-weight: bold;
                      margin-bottom: 5px;
                      display: block;
                  }
                  .km-input {
                      width: 100%;
                      padding: 10px;
                      margin-bottom: 10px;
                      border: 1px solid #ccc;
                      border-radius: 5px;
                      box-sizing: border-box;
                      background: #fff;
                      color: #000;
                  }
                  .button-container {
                      display: flex;
                      justify-content: space-between;
                  }
                  .km-button {
                      flex: 1;
                      padding: 10px 20px;
                      color: #080808;
                      border: none;
                      border-radius: 5px;
                      cursor: pointer;
                      font-size: 16px;
                      margin-top: 10px;
                      margin-right: 10px;
                      box-sizing: border-box;
                      background: #4CAF50;
                  }
                  .km-button:hover {
                      background: #45a049;
                  }
                  .km-form input:focus, .km-form button:focus {
                      outline: 2px solid #4CAF50;
                  }
                  .km-form button:disabled {
                      background: #ccc;
                      cursor: not-allowed;
                  }
              </style>
          `);
      };

      this.calculate = function () {
          var settings = self.get_settings();
          var customValue1 = parseInt(settings.custom_value_1, 10);
          var customValue2 = parseInt(settings.custom_value_2, 10);

          if (isNaN(customValue1)) customValue1 = 180;
          if (isNaN(customValue2)) customValue2 = 90;

          console.log('Custom Value 1:', customValue1);
          console.log('Custom Value 2:', customValue2);

          var leadId = APP.data.current_card.id;

          $.ajax({
              url: '/api/v4/leads/' + leadId,
              method: 'GET',
              dataType: 'json',
              success: function (data) {
                  console.log('Lead data:', data);
                  var fields = [1144348, 1144354, 1144356, 1147161, 1147163, 1147165];
                  var sum = 0;

                  fields.forEach(function (field_id) {
                      var field = data.custom_fields_values.find(f => f.field_id === field_id);
                      var value = field && field.values.length > 0 ? parseInt(field.values[0].value, 10) : 0;
                      sum += value;
                  });

                  var customField1143754 = data.custom_fields_values.find(f => f.field_id === 1143754);
                  var customFieldValue = customField1143754 && customField1143754.values.length > 0 ? customField1143754.values[0].value : '';
                  var baseValue = customFieldValue === "Matrimonios" ? customValue1 : customValue2;

                  console.log('Tipo de Encuentro:', customFieldValue);
                  console.log('Base Value:', baseValue);

                  var remaining = baseValue - sum;

                  if (remaining < 0) {
                      $('#calculation-result').text('Resultado: ' + sum + ', Restante: ' + remaining);
                      self.showSnackbar('Verifique los campos de pago. La resta resultó en un valor negativo.');
                      return;
                  }

                  self.updateField(1146883, sum);
                  self.updateField(1146885, remaining);

                  $('#calculation-result').text('Resultado: ' + sum + ', Restante: ' + remaining);
              },
              error: function (error) {
                  console.error('Error fetching lead data:', error);
                  self.showSnackbar('Error fetching lead data: ' + error.statusText);
              }
          });
      };

      this.updateField = function (fieldId, value) {
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
              success: function (response) {
                  console.log('Campo actualizado:', response);
                  self.showSnackbar('El cálculo se ha guardado correctamente.');
              },
              error: function (error) {
                  console.error('Error al actualizar el campo:', error);
                  self.showSnackbar('Error al guardar los datos: ' + error.statusText);
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

      // Función para guardar configuraciones
      this.save_settings = function (settings) {
          return new Promise((resolve, reject) => {
              try {
                  // Guardar configuraciones en el sistema
                  AMOCRM.widgets.settings_save({
                      settings: settings
                  }, resolve);
              } catch (error) {
                  reject(error);
              }
          });
      };

      return this;
  };
  return CustomWidget;
});
