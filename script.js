define(['jquery'], function ($) {
    var CustomWidget = function () {
        var self = this;
  
        this.callbacks = {
            settings: function () {
                var $modal_body = $('.modal-body');
                var $widget_settings = $modal_body.find('.widget_settings_block');
  
                var settingsHTML = `
                    <div class="km-form">
                        <label for="matrimonios-value">Valor para Matrimonios:</label>
                        <input type="number" id="matrimonios-value" value="180">
  
                        <label for="otros-value">Valor para Otros Encuentros:</label>
                        <input type="number" id="otros-value" value="90">
  
                        <div class="button-container">
                            <button id="save-btn" class="km-button">Guardar</button>
                        </div>
                    </div>
                `;
  
                $widget_settings.html(settingsHTML);
  
                $('#save-btn').on('click', function () {
                    alert('Los valores no se guardan realmente, pero se puede cambiar visualmente.');
                });
  
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
            var styles = `
                .km-form {
                    padding: 15px;
                    background: #2F2662;
                    border: 1px solid #ddd;
                    border-radius: 5px;
                    max-width: 400px;
                    margin: 0 auto;
                }
                .km-form input[type="text"], .km-form input[type="number"], .km-form select {
                    width: 100%;
                    padding: 10px;
                    margin-bottom: 10px;
                    border: 1px solid #ccc;
                    border-radius: 5px;
                    box-sizing: border-box;
                    background: #fff;
                    color: #000;
                }
                .km-form .button-container {
                    display: flex;
                    justify-content: space-between;
                }
                .km-form button {
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
                .km-form #calculate-btn {
                    background: #ffff;
                }
                .km-form #calculate-btn:hover {
                    background: #878686;
                }
                .km-form #save-btn {
                    background: #4CAF50;
                    margin-right: 0;
                }
                .km-form #save-btn:hover {
                    background: #45a049;
                }
                .km-form label {
                    color: #fff;
                    font-weight: bold;
                    margin-bottom: 5px;
                    display: block;
                }
                #calculation-result {
                    margin-top: 15px;
                    font-size: 16px;
                    color: #fff;
                }
                #calculation-result p {
                    margin: 0;
                }
                #snackbar {
                    visibility: hidden;
                    min-width: 250px;
                    margin-left: -125px;
                    background-color: #333;
                    color: #fff;
                    text-align: center;
                    border-radius: 2px;
                    padding: 16px;
                    position: fixed;
                    z-index: 1;
                    left: 50%;
                    bottom: 30px;
                    font-size: 17px;
                }
                #snackbar.show {
                    visibility: visible;
                    -webkit-animation: fadein 0.5s, fadeout 0.5s 2.5s;
                    animation: fadein 0.5s, fadeout 0.5s 2.5s;
                }
                @-webkit-keyframes fadein {
                    from {bottom: 0; opacity: 0;}
                    to {bottom: 30px; opacity: 1;}
                }
                @keyframes fadein {
                    from {bottom: 0; opacity: 0;}
                    to {bottom: 30px; opacity: 1;}
                }
                @-webkit-keyframes fadeout {
                    from {bottom: 30px; opacity: 1;}
                    to {bottom: 0; opacity: 0;}
                }
                @keyframes fadeout {
                    from {bottom: 30px; opacity: 1;}
                    to {bottom: 0; opacity: 0;}
                }
            `;
            $('head').append('<style>' + styles + '</style>');
        };
  
        this.calculate = function () {
            var baseValueForMatrimonios = 180;
            var baseValueForOthers = 90;
  
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
                    var baseValue = customFieldValue === "Matrimonios" ? baseValueForMatrimonios : baseValueForOthers;
  
                    console.log('Tipo de Encuentro:', customFieldValue);
                    console.log('Base Value:', baseValue);
  
                    var remaining = baseValue - sum;
  
                    // Validación adicional
                    var field1152796 = data.custom_fields_values.find(f => f.field_id === 1152796);
                    var value1152796 = field1152796 && field1152796.values.length > 0 ? parseInt(field1152796.values[0].value, 10) : null;
  
                    var customField1144366 = data.custom_fields_values.find(f => f.field_id === 1144366);
                    var customFieldValue1144366 = customField1144366 && customField1144366.values.length > 0 ? customField1144366.values[0].value : '';
  
                    if (customFieldValue1144366 === 'Traspaso' && value1152796 !== null) {
                        remaining = sum - value1152796;
                        self.updateField(1152798, remaining);
                    } else {
                        if (remaining < 0) {
                            $('#calculation-result').text('Resultado: ' + sum + ', Restante: ' + remaining);
                            self.showSnackbar('Verifique los campos de pago. La resta resultó en un valor negativo.');
                            return;
                        }
  
                        self.updateField(1146883, sum);
                        self.updateField(1146885, remaining);
  
                        $('#calculation-result').text('Resultado: ' + sum + ', Restante: ' + remaining);
                    }
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
  
        return this;
    };
  
    return CustomWidget;
  });
  