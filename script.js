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
        // Evento para eliminar entradas
        $(document).off('click', '.delete-entry-btn').on('click', '.delete-entry-btn', function () {
          var idx = $(this).data('idx');
          self.deleteEntry(idx);
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
    // ...existing code...
    this.loadCSS = function() {
      var settings = self.get_settings();
      if ($('link[href="' + settings.path + '/style.css?v=' + settings.version + '"]').length < 1) {
        $('head').append('<link href="' + settings.path + '/style.css?v=' + settings.version + '" rel="stylesheet">');
      }
      $('head').append('<style>\
        .km-hours-widget { font-family: Arial, sans-serif; padding: 10px; max-width: 320px; margin: 0 auto; }\
        .km-hours-widget label { display: flex; flex-direction: column; margin: 6px 0; font-size: 13px; }\
        .km-hours-widget input, .km-hours-widget textarea { width: 100%; padding: 4px; margin-top: 2px; font-size: 13px; box-sizing: border-box; }\
        .km-hours-widget button { margin-top: 10px; padding: 6px 12px; border-radius: 4px; border: 1px solid #0073AA; background: #0085ba; color: #fff; cursor: pointer; font-size: 13px; width: 100%; }\
        .km-hours-widget .history-table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 12px; }\
        .km-hours-widget .history-table th, .km-hours-widget .history-table td { border: 1px solid #ddd; padding: 4px 3px; text-align: left; word-break: break-word; }\
        .km-hours-widget .history-table th { background: none; }\
        .delete-entry-btn { background: none; border: none; color: #e74c3c; padding: 0 4px; border-radius: 3px; cursor: pointer; font-size: 16px; line-height: 1; }\
        #widget-summary p { margin: 4px 0 0 0; font-size: 13px; }\
        #snackbar { visibility: hidden; min-width: 250px; margin-left: -125px; background-color: #333; color: #fff; text-align: center; border-radius: 2px; padding: 16px; position: fixed; z-index: 1; left: 50%; bottom: 30px; font-size: 17px; }\
        #snackbar.show { visibility: visible; -webkit-animation: fadein 0.5s, fadeout 0.5s 2.5s; animation: fadein 0.5s, fadeout 0.5s 2.5s; }\
        @keyframes fadein { from { bottom: 0; opacity: 0; } to { bottom: 30px; opacity: 1; } }\
        @keyframes fadeout { from { bottom: 30px; opacity: 1; } to { bottom: 0; opacity: 0; } }\
        /* Modal estilos */\
        #history-modal { display:none; position:fixed; z-index:9999; left:0; top:0; width:100vw; height:100vh; background:rgba(0,0,0,0.4); }\
        #history-modal .modal-content { background:#fff; color:#111; max-width:500px; margin:60px auto; padding:20px; position:relative; border-radius:8px; box-shadow:0 2px 16px rgba(0,0,0,0.15); }\
        #close-history-modal { position:absolute; top:8px; right:8px; font-size:22px; background:#fff; color:#111; border:1px solid #ccc; border-radius:50%; width:32px; height:32px; cursor:pointer; display:flex; align-items:center; justify-content:center; transition:background 0.2s; }\
        #close-history-modal:hover { background:#f2f2f2; }\
      </style>');
    };
    // ...existing code...

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
          '<button id="open-history-modal" style="margin-top:10px;">Ver historial</button>' +
          // Modal oculto por defecto
          '<div id="history-modal">' +
            '<div class="modal-content">' +
              '<button id="close-history-modal" title="Cerrar">&times;</button>' +
              '<h4>Historial de Horas</h4>' +
              '<table class="history-table"><thead><tr><th>Fecha</th><th>Tarea(s)</th><th>Horas</th><th>Restante</th><th>Acción</th></tr></thead><tbody id="widget-history"></tbody></table>' +
            '</div>' +
          '</div>' +
        '</div>';
    
      self.render_template({
        caption: { html: '' },
        body: html,
        render: ''
      });
    
      // Eventos para abrir/cerrar el modal
      $(document).off('click', '#open-history-modal').on('click', '#open-history-modal', function() {
        $('#history-modal').show();
      });
      $(document).off('click', '#close-history-modal').on('click', '#close-history-modal', function() {
        $('#history-modal').hide();
      });
    };

    // Mostrar el resumen y la tabla de historial
    this.renderHistory = function() {
      var json = self.data;
    
      // Mostrar resumen de paquete y restante (el paquete inicial nunca cambia)
      var last = json.actividades.length ? json.actividades[json.actividades.length - 1].tiempo_restante : json.paquete_horas;
      $('#widget-summary').html(
        '<p><strong>Paquete inicial:</strong> ' + json.paquete_horas + 'h</p>' +
        '<p><strong>Tiempo restante:</strong> ' + last + 'h</p>'
      );
    
      // Construir filas de historial con botón eliminar (solo ícono)
      var rows = '';
      json.actividades.forEach(function(act, idx) {
        var tareas = act.tareas.map(t => t.descripcion + ' (' + t.horas + 'h)').join('<br>');
        rows += '<tr>' +
                  '<td>' + act.fecha + '</td>' +
                  '<td>' + tareas + '</td>' +
                  '<td>' + act.tareas.reduce((sum, t) => sum + t.horas, 0) + '</td>' +
                  '<td>' + act.tiempo_restante + '</td>' +
                  '<td><button class="delete-entry-btn" data-idx="' + idx + '" title="Eliminar"><span aria-label="Eliminar" role="img">🗑️</span></button></td>' +
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
      if (!dateVal || !desc || !hrs || isNaN(parseFloat(hrs))) {
        self.showSnackbar('Por favor completa todos los campos correctamente.');
        return;
      }

      var fechaFormateada = new Date(dateVal + 'T05:00:00.000Z').toLocaleDateString('es-PE', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    
      var horasNum = parseFloat(hrs);
      var json = self.data || { paquete_horas: 0, actividades: [] };
      var prev = json.actividades.length ? json.actividades[json.actividades.length - 1].tiempo_restante : json.paquete_horas;
      var restante = prev + horasNum; // Suma o resta dependiendo del signo de horasNum
    
      var nueva = {
        fecha: fechaFormateada,
        tareas: [{ descripcion: desc, horas: horasNum }],
        tiempo_restante: restante
      };
      json.actividades.push(nueva);
    
      self.updateData(json, 'Registro agregado correctamente.');
    };
    
    // Eliminar una entrada y actualizar el campo en Kommo
    this.deleteEntry = function(idx) {
      var json = self.data || { paquete_horas: 0, actividades: [] };
      json.actividades.splice(idx, 1);
    
      // Recalcular los tiempos restantes
      var restante = json.paquete_horas;
      json.actividades.forEach(function(act) {
        var horas = act.tareas.reduce((sum, t) => sum + t.horas, 0);
        restante += horas; // Recalcula correctamente el tiempo restante
        act.tiempo_restante = restante;
      });
    
      self.updateData(json, 'Registro eliminado correctamente.');
    };
    
    // Actualizar el campo personalizado en Kommo
    this.updateData = function(json, successMessage) {
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
          self.showSnackbar(successMessage);
        },
        error: function(err) {
          self.showSnackbar('Error al guardar: ' + err.statusText);
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