define(['jquery'], function ($) {
  var CustomWidget = function () {
    var self = this;

    this.callbacks = {
      settings: function () {
        var $modal_body = $('.modal.' + self.get_settings().widget_code + ' .modal-body'),
            $widget_settings = $modal_body.find('.widget_settings_block');

        // Crear el formulario directamente en la sección de configuración
        var settings_form = `
          <form id="${self.get_settings().widget_code}-settings__form" class="km-settings-form">
            <div class="widget-settings__item">
              <label for="custom_value_1">Valor para Matrimonios</label>
              <input type="number" id="custom_value_1" name="custom_value_1" value="${self.get_settings().custom_value_1 || 180}">
            </div>
            <div class="widget-settings__item">
              <label for="custom_value_2">Valor para otros tipos</label>
              <input type="number" id="custom_value_2" name="custom_value_2" value="${self.get_settings().custom_value_2 || 90}">
            </div>
          </form>
        `;

        // Inyectar el formulario en la ventana de configuración
        $widget_settings.html(settings_form);
        self.injectStyles(); // Aplicar los estilos
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
        self.injectStyles(); // Aplicar los estilos
        return true;
      },
      onSave: function () {
        // Guardar la configuración
        var settings_data = {
          custom_value_1: $('#custom_value_1').val(),
          custom_value_2: $('#custom_value_2').val(),
        };

        self.get_settings().custom_value_1 = settings_data.custom_value_1;
        self.get_settings().custom_value_2 = settings_data.custom_value_2;

        return true;
      },
      leads: {
        selected: function () {
          return true;
        }
      },
      destroy: function () {}
    };

    this.injectStyles = function() {
      var styles = `
        /* Estilos para el contenedor del formulario */
        .km-form, .km-settings-form {
          padding: 15px;
          background: #2F2662;
          border: 1px solid #ddd;
          border-radius: 5px;
          max-width: 400px;
          margin: 0 auto;
        }
        /* Estilos para los inputs de texto y el select */
        .km-form input[type="text"], .km-form input[type="number"], .km-form select,
        .km-settings-form input[type="text"], .km-settings-form input[type="number"], .km-settings-form select {
          width: 100%;
          padding: 10px;
          margin-bottom: 10px;
          border: 1px solid #ccc;
          border-radius: 5px;
          box-sizing: border-box;
          background: #fff; /* Asegura un fondo blanco para mejor contraste */
          color: #000; /* Color del texto en los inputs */
        }
        /* Contenedor para los botones */
        .km-form .button-container, .km-settings-form .button-container {
          display: flex;
          justify-content: space-between;
        }
        /* Estilos para los botones de calcular y guardar */
        .km-form button, .km-settings-form button {
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
        }
        /* Estilo específico para el botón de calcular */
        .km-form #calculate-btn {
          background: #ffff;
        }
        .km-form #calculate-btn:hover {
          background: #878686;
        }
        /* Estilo específico para el botón de guardar */
        .km-form #save-btn, .km-settings-form #save-btn {
          background: #4CAF50;
          margin-right: 0; /* Para evitar margen extra en el último botón */
        }
        .km-form #save-btn:hover, .km-settings-form #save-btn:hover {
          background: #45a049;
        }
        /* Estilos para las etiquetas dentro del contenedor del formulario */
        .km-form label, .km-settings-form label {
          color: #fff; /* Cambia el color del texto a blanco */
          font-weight: bold; /* Resalta las etiquetas */
          margin-bottom: 5px;
          display: block;
        }
        /* Estilos para el resultado del cálculo */
        #calculation-result {
          margin-top: 15px;
          font-size: 16px;
          color: #fff;
        }
        /* Estilos para los mensajes de resultado */
        #calculation-result p {
          margin: 0;
        }
        /* Estilos adicionales para mejorar la accesibilidad y la experiencia del usuario */
        .km-form input:focus, .km-form select:focus, .km-form button:focus,
        .km-settings-form input:focus, .km-settings-form select:focus, .km-settings-form button:focus {
          outline: 2px solid #4CAF50; /* Añade un borde verde al enfocarse */
        }
        .km-form button:disabled, .km-settings-form button:disabled {
          background: #ccc; /* Botón desactivado en gris */
          cursor: not-allowed;
        }
        /* Ajustes responsivos para dispositivos móviles */
        @media (max-width: 480px) {
          .km-form, .km-settings-form {
            padding: 10px;
          }
          .km-form button, .km-settings-form button {
            margin-right: 0;
            margin-top: 10px;
          }
          .km-form .button-container, .km-settings-form .button-container {
            flex-direction: column;
          }
        }
      `;
      $('head').append('<style>' + styles + '</style>');
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

          // Usar los valores personalizados del settings
          var baseValue = customFieldValue === "Matrimonios" ? self.get_settings().custom_value_1 : self.get_settings().custom_value_2;

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
