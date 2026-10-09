define(['jquery'], function ($) {
  var CustomWidget = function () {
    var self = this;

    var ROOT_ID = 'kai-root';
    var RANGE_KEY = 'kai_range_days_v1';
    var DEFAULT_RANGE_DAYS = 14;
    var RANGE_OPTIONS = [
      { days: 7,  label: 'Última semana' },
      { days: 14, label: 'Últimas 2 semanas' },
      { days: 21, label: 'Últimas 3 semanas' },
      { days: 28, label: 'Últimas 4 semanas' },
      { days: 30, label: 'Últimos 30 días' }
    ];

    this.callbacks = {
      settings: function () { return true; },
      init:     function () { self.loadCSS(); return true; },
      bind_actions: function () { return true; },

      render: function () {
        if (APP.data.is_card && APP.data.current_entity === 'leads') {
          self.mount();
          return true;
        }
        return true;
      },

      onSave:  function () { return true; },
      destroy: function () {}
    };

    // Montaje del panel

    this.mount = function () {
      self.render_template({
        caption: { class_name: 'kai-widget' },
        body: '',
        render: self.shellHtml()
      });

      setTimeout(function () {
        self.ensureMounted();
        self.bindActions();
      }, 0);
    };

    /**
     * Kommo no adjunta style.css de forma confiable ni siquiera en la card
     * (verificado en vivo: el <link> nunca apareció para este widget aunque
     * otros widgets instalados sí lo tienen) — se carga a mano, con guarda
     * para no duplicar el <link> si Kommo alguna vez sí lo inyecta.
     */
    this.loadCSS = function () {
      var settings = self.get_settings() || {};
      if (!settings.path) return;
      var href = settings.path + '/style.css?v=' + settings.version;
      if ($('link[href="' + href + '"]').length) return;
      $('head').append('<link href="' + href + '" type="text/css" rel="stylesheet">');
    };

    this.ensureMounted = function () {
      if (document.getElementById(ROOT_ID)) return;

      var code = (self.get_settings() || {}).widget_code;
      var $target = $();

      if (code) {
        $target = $('#widget_' + code + ' .widget_body');
        if (!$target.length) $target = $('#widget_' + code);
      }
      if (!$target.length) $target = $('.kai-widget').first();

      if ($target.length) {
        $target.append(self.shellHtml());
      } else {
        console.warn('[KAI] No se encontró el contenedor del widget para montar el panel.');
      }
    };

    this.bindActions = function () {
      var $root = $('#' + ROOT_ID);

      $root.off('.kai')
        .on('click.kai', '#kai-generate',   function () { self.generate(); })
        .on('click.kai', '#kai-regenerate', function () { self.generate(); })
        .on('click.kai', '#kai-copy',       function () { self.copy(); })
        .on('change.kai', '#kai-range', function () { self.saveRangePref(parseInt($(this).val(), 10)); })
        .on('mousedown.kai click.kai', function (e) { e.stopPropagation(); });
    };

    this.shellHtml = function () {
      return '' +
        '<div id="' + ROOT_ID + '" class="kai">' +
          '<div class="kai-hint">Genera, con IA, un mensaje de seguimiento final a partir del chat de este lead.</div>' +
          '<label class="kai-range">Rango de historial a analizar' +
            '<select id="kai-range" class="kai-select">' + self.rangeOptionsHtml() + '</select>' +
          '</label>' +
          '<button type="button" id="kai-generate" class="kai-btn kai-btn--primary">Generar mensaje de seguimiento</button>' +
          '<div id="kai-status" class="kai-status"></div>' +
          '<div id="kai-result" class="kai-result" style="display:none;">' +
            '<textarea id="kai-message" class="kai-message" rows="6"></textarea>' +
            '<div class="kai-actions">' +
              '<button type="button" id="kai-copy" class="kai-btn">Copiar</button>' +
              '<button type="button" id="kai-regenerate" class="kai-btn">Regenerar</button>' +
            '</div>' +
          '</div>' +
        '</div>';
    };

    this.rangeOptionsHtml = function () {
      var pref = self.loadRangePref();
      return RANGE_OPTIONS.map(function (opt) {
        var selected = opt.days === pref ? ' selected' : '';
        return '<option value="' + opt.days + '"' + selected + '>' + opt.label + '</option>';
      }).join('');
    };

    this.loadRangePref = function () {
      try {
        var v = parseInt(localStorage.getItem(RANGE_KEY), 10);
        if (RANGE_OPTIONS.some(function (o) { return o.days === v; })) return v;
      } catch (e) {}
      return DEFAULT_RANGE_DAYS;
    };

    this.saveRangePref = function (days) {
      try { localStorage.setItem(RANGE_KEY, String(days)); } catch (e) {}
    };

    this.status = function (msg, kind) {
      $('#kai-status')
        .attr('class', 'kai-status' + (kind ? ' kai-status--' + kind : ''))
        .text(msg || '');
    };

    this.generate = function () {
      var settings = self.get_settings() || {};
      if (!settings.proxy_url || !settings.widget_key) {
        self.status('Falta configurar la URL del proxy y la clave en los ajustes del widget.', 'error');
        return;
      }

      var leadId = APP.data.current_card.id;
      var proxyUrl = (settings.proxy_url || '').replace(/\/+$/, '');
      var days = parseInt($('#kai-range').val(), 10) || DEFAULT_RANGE_DAYS;

      $('#kai-generate, #kai-regenerate, #kai-copy').prop('disabled', true);
      $('#kai-result').hide();
      self.status('Generando mensaje…');

      $.ajax({
        url: proxyUrl + '/followup?lead_id=' + leadId + '&days=' + days,
        type: 'POST',
        dataType: 'json',
        headers: { 'X-Widget-Key': settings.widget_key }
      })
        .done(function (payload) {
          if (payload.used_full_history) {
            self.status('Sin mensajes en el rango elegido; se usó el historial completo.', 'warn');
          } else {
            self.status('');
          }
          $('#kai-message').val(payload.message || '');
          $('#kai-result').show();
        })
        .fail(function (xhr) {
          self.status(self.errorText(xhr), 'error');
        })
        .always(function () {
          $('#kai-generate, #kai-regenerate, #kai-copy').prop('disabled', false);
        });
    };

    this.copy = function () {
      var text = $('#kai-message').val() || '';
      if (!text) return;

      var restore = function () {
        setTimeout(function () { $('#kai-copy').text('Copiar'); }, 1200);
      };

      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(function () {
          $('#kai-copy').text('¡Copiado!');
          restore();
        });
        return;
      }

      var $ta = $('#kai-message');
      $ta[0].select();
      document.execCommand('copy');
      $('#kai-copy').text('¡Copiado!');
      restore();
    };

    this.errorText = function (xhr) {
      var body = xhr.responseJSON || {};
      if (xhr.status === 0)   return 'No se pudo contactar el proxy (revisá la URL y el CORS).';
      if (xhr.status === 401) return 'Clave del widget inválida.';
      if (xhr.status === 404 && body.error === 'empty_conversation') {
        return 'Este lead no tiene mensajes de chat todavía.';
      }
      if (xhr.status === 503 && body.error === 'ai_not_configured') {
        return 'Falta cargar la clave de OpenAI en el proxy.';
      }
      if (xhr.status === 503) return 'El proxy no está autorizado todavía. Completá el paso de OAuth.';
      if (xhr.status === 502) return 'Error generando el mensaje con IA. Probá de nuevo.';
      return 'Error ' + xhr.status + (body.detail ? ': ' + body.detail : '');
    };

    return this;
  };

  return CustomWidget;
});
