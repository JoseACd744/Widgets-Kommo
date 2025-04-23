define(['jquery'], function ($) {
  var CustomWidget = function () {
    var self = this;

    // ID del campo personalizado donde se almacena el JSON de horas/historial
    this.jsonFieldId = 2968264;

    this.callbacks = {
      settings: function () {
        return true;
      },
      init: function () {
        self.loadCSS();
        return true;
      },
      bind_actions: function () {
        // Agregar entrada al historial
        $(document).off('click', '#add-entry-btn').on('click', '#add-entry-btn', function () {
          self.addEntry();
        });
        return true;
      },
      render: function () {
        // Renderizamos formulario e historial
        self.renderTemplate();
        self.loadData();
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

    // Carga de estilos mínimos para el widget
    this.loadCSS = function() {
      var settings = self.get_settings();
      if ($('link[href="' + settings.path + '/style.css?v=' + settings.version + '"]').length < 1) {
        $('head').append('<link href="' + settings.path + '/style.css?v=' + settings.version + '" rel="stylesheet">');
      }
      $('head').append('<style>\
        .km-hours-widget { font-family: Arial, sans-serif; padding: 10px; }\
        .km-hours-widget label { display: block; margin: 5px 0; }\
        .km-hours-widget input, .km-hours-widget textarea { width: 100%; padding: 4px; margin-top: 2px; }\
        .km-hours-widget button { margin-top: 10px; padding: 6px 12px; border-radius: 4px; border: 1px solid #0073AA; background: #0085ba; color: #fff; cursor: pointer; }\
        .km-hours-widget .history-table { width: 100%; border-collapse: collapse; margin-top: 10px; }\
        .km-hours-widget .history-table th, .km-hours-widget .history-table td { border: 1px solid #ddd; padding: 6px; text-align: left; }\
        #snackbar { visibility: hidden; min-width: 250px; margin-left: -125px; background-color: #333; color: #fff; text-align: center; border-radius: 2px; padding: 16px; position: fixed; z-index: 1; left: 50%; bottom: 30px; font-size: 17px; }\
        #snackbar.show { visibility: visible; -webkit-animation: fadein 0.5s, fadeout 0.5s 2.5s; animation: fadein 0.5s, fadeout 0.5s 2.5s; }\
        @keyframes fadein { from { bottom: 0; opacity: 0; } to { bottom: 30px; opacity: 1; } }\
        @keyframes fadeout { from { bottom: 30px; opacity: 1; } to { bottom: 0; opacity: 0; } }\
      </style>');
    };

    // Obtener el JSON actual desde el campo personalizado
    this.loadData = function() {
      var leadId = APP.data.current_card.id;
      $.ajax({
        url: '/api/v4/leads/' + leadId,
        method: 'GET',
        dataType: 'json',
        success: function(data) {
          // Buscamos el valor del campo JSON
          var field = data.custom_fields_values.find(f => f.field_id === self.jsonFieldId);
          var raw = field && field.values.length ? field.values[0].value : '';
          try {
            self.data = JSON.parse(raw);
          } catch (e) {
            // Estructura inicial si está vacío o inválido
            self.data = { paquete_horas: 0, actividades: [] };
          }
          self.renderHistory();
        },
      });
    };

    // Construir la UI del widget
    this.renderTemplate = function() {
      var html = '' +
        '<div class="km-hours-widget">' +
          '<h3>Historial de Horas</h3>' +
          '<label>Fecha:<input type="date" id="entry-date" /></label>' +
          '<label>Descripción:<textarea id="entry-desc" rows="2"></textarea></label>' +
          '<label>Horas (positivo / negativo):<input type="number" id="entry-hours" /></label>' +
          '<button id="add-entry-btn">Agregar Registro</button>' +
          '<div id="widget-summary"></div>' +
          '<table class="history-table"><thead><tr><th>Fecha</th><th>Tarea(s)</th><th>Horas</th><th>Restante</th></tr></thead><tbody id="widget-history"></tbody></table>' +
        '</div>';

      self.render_template({
        caption: { html: '' },
        body: html,
        render: ''
      });
    };

    // Mostrar el resumen y la tabla de historial
    this.renderHistory = function() {
      var json = self.data;

      // Mostrar resumen de paquete y restante
      var last = json.actividades.length ? json.actividades[json.actividades.length - 1].tiempo_restante : json.paquete_horas;
      $('#widget-summary').html(
        '<p><strong>Paquete inicial:</strong> ' + json.paquete_horas + 'h</p>' +
        '<p><strong>Tiempo restante:</strong> ' + last + 'h</p>'
      );

      // Construir filas de historial
      var rows = '';
      json.actividades.forEach(function(act) {
        var tareas = act.tareas.map(t => t.descripcion + ' (' + t.horas + 'h)').join('<br>');
        rows += '<tr>' +
                  '<td>' + act.fecha + '</td>' +
                  '<td>' + tareas + '</td>' +
                  '<td>' + act.tareas.reduce((sum, t) => sum + t.horas, 0) + '</td>' +
                  '<td>' + act.tiempo_restante + '</td>' +
                '</tr>';
      });
      $('#widget-history').html(rows);
    };

    // Agregar nueva entrada y actualizar el campo en Kommo
    this.addEntry = function() {
      var dateVal = $('#entry-date').val();
      var desc = $('#entry-desc').val().trim();
      var hrs = $('#entry-hours').val();
    
      // Validaciones específicas
      if (!dateVal) {
        self.showSnackbar('Por favor selecciona una fecha válida');
        return;
      }
    
      if (!desc) {
        self.showSnackbar('La descripción no puede estar vacía');
        return;
      }
    
      if (!hrs) {
        self.showSnackbar('Por favor ingresa la cantidad de horas');
        return;
      }
    
      // Validar que las horas sean un número válido
      var horasNum = parseFloat(hrs);
      if (isNaN(horasNum)) {
        self.showSnackbar('El formato de horas no es válido. Usa números (ej: 2.5)');
        return;
      }
    
      // Validar que la fecha no sea futura
      var selectedDate = new Date(dateVal);
      var today = new Date();
      if (selectedDate > today) {
        self.showSnackbar('No puedes registrar horas para fechas futuras');
        return;
      }
    
      var fechaFormateada = new Date(dateVal + 'T05:00:00.000Z').toLocaleDateString('es-PE', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      });
    
      var json = self.data;
      var prev = json.actividades.length ? json.actividades[json.actividades.length - 1].tiempo_restante : json.paquete_horas;
      // Corregimos el cálculo del tiempo restante
      var restante = prev + horasNum; // Cambiamos la resta por suma porque el número negativo ya viene en horasNum
    
      var nueva = {
        fecha: fechaFormateada,
        tareas: [{ descripcion: desc, horas: horasNum }], // Usamos horasNum en lugar de hrs para asegurar que es número
        tiempo_restante: restante
      };
      json.actividades.push(nueva);

      // Actualizamos el campo custom con el JSON completo
      var leadId = APP.data.current_card.id;
      var payload = { custom_fields_values: [{ field_id: self.jsonFieldId, values: [{ value: JSON.stringify(json) }] }] };
      $.ajax({
        url: '/api/v4/leads/' + leadId,
        method: 'PATCH',
        contentType: 'application/json',
        data: JSON.stringify(payload),
        success: function() {
          self.data = json;
          self.renderHistory();
          self.showSnackbar('Registro agregado correctamente.');
        },
        error: function(err) {
          self.showSnackbar('Error guardando: ' + err.statusText);
        }
      });
    };

    // Mostrar notificaciones estilo snackbar
    this.showSnackbar = function(message) {
      var sb = $('#snackbar');
      if (!sb.length) {
        $('body').append('<div id="snackbar"></div>');
        sb = $('#snackbar');
      }
      sb.text(message).addClass('show');
      setTimeout(function() { sb.removeClass('show'); }, 3000);
    };

    return this;
  };

  return CustomWidget;
});
