define(['jquery'], function ($) {
  var CustomWidget = function () {
    var self = this;

    var ROOT_ID = 'kec-root';

    // Datos de la última carga, reutilizados por los botones de exportación.
    var payload = null;   // respuesta cruda del proxy
    var leadInfo = null;  // { id, name, contacts: [...] }

    var TYPE_LABEL = {
      text:     '',
      picture:  '[imagen]',
      file:     '[archivo]',
      video:    '[video]',
      voice:    '[nota de voz]',
      audio:    '[audio]',
      sticker:  '[sticker]',
      location: '[ubicación]',
      contact:  '[contacto]'
    };

    this.callbacks = {
      settings: function () { return true; },
      init:     function () { return true; },
      bind_actions: function () { return true; },

      render: function () {
        if (!APP.data.is_card || APP.data.current_entity !== 'leads') return true;
        self.mount();
        return true;
      },

      onSave:  function () { return true; },
      destroy: function () {}
    };

    // ─── Montaje del panel ────────────────────────────────────────────────────

    this.mount = function () {
      // Según la versión, Kommo renderiza templates/widget.twig por su cuenta o
      // usa el HTML que se le pasa en `render`. Se le pasa el shell y después se
      // comprueba que haya quedado montado; si no, se inyecta a mano.
      self.render_template({
        caption: { class_name: 'kec-widget' },
        body: '',
        render: self.shellHtml()
      });

      setTimeout(self.ensureMounted, 0);

      // Handlers delegados: sobreviven a los re-render del panel de Kommo.
      $(document)
        .off('click.kec')
        .on('click.kec', '#kec-load',    function () { self.load(); })
        .on('click.kec', '#kec-txt',     function () { self.exportTxt(); })
        .on('click.kec', '#kec-csv',     function () { self.exportCsv(); })
        .on('click.kec', '#kec-json',    function () { self.exportJson(); })
        .on('click.kec', '#kec-pdf',     function () { self.exportPdf(); });
    };

    /** Si el shell no quedó en el DOM, lo inyecta en el contenedor del widget. */
    this.ensureMounted = function () {
      if (document.getElementById(ROOT_ID)) return;

      var code = (self.get_settings() || {}).widget_code;
      var $target = $();

      if (code) {
        $target = $('#widget_' + code + ' .widget_body');
        if (!$target.length) $target = $('#widget_' + code);
      }
      if (!$target.length) $target = $('.kec-widget').first();

      if ($target.length) {
        $target.append(self.shellHtml());
      } else {
        console.warn('[KEC] No se encontró el contenedor del widget para montar el panel.');
      }
    };

    this.shellHtml = function () {
      return '' +
        '<div id="' + ROOT_ID + '" class="kec">' +
          '<button type="button" id="kec-load" class="kec-btn kec-btn--primary">' +
            'Cargar conversación' +
          '</button>' +
          '<div id="kec-status" class="kec-status"></div>' +
          '<div id="kec-summary" class="kec-summary" style="display:none;"></div>' +
          '<div id="kec-actions" class="kec-actions" style="display:none;">' +
            '<button type="button" id="kec-txt"  class="kec-btn">TXT</button>' +
            '<button type="button" id="kec-csv"  class="kec-btn">CSV</button>' +
            '<button type="button" id="kec-pdf"  class="kec-btn">PDF</button>' +
            '<button type="button" id="kec-json" class="kec-btn">JSON</button>' +
          '</div>' +
        '</div>';
    };

    this.status = function (msg, kind) {
      $('#kec-status')
        .attr('class', 'kec-status' + (kind ? ' kec-status--' + kind : ''))
        .text(msg || '');
    };

    // ─── Carga de datos ───────────────────────────────────────────────────────

    this.load = function () {
      var settings = self.get_settings() || {};
      var proxyUrl = (settings.proxy_url || '').replace(/\/+$/, '');
      var widgetKey = settings.widget_key || '';

      if (!proxyUrl || !widgetKey) {
        self.status('Falta configurar la URL del proxy y la clave en los ajustes del widget.', 'error');
        return;
      }

      var leadId = APP.data.current_card.id;

      $('#kec-load').prop('disabled', true);
      $('#kec-actions').hide();
      $('#kec-summary').hide();
      self.status('Cargando conversación…');

      // El nombre del lead y sus contactos sí se pueden leer con la sesión del
      // navegador: solo /talks/{id}/messages está limitado por scope.
      $.ajax({ url: '/api/v4/leads/' + leadId + '?with=contacts', dataType: 'json' })
        .always(function (lead) {
          leadInfo = {
            id: leadId,
            name: (lead && lead.name) || ('Lead #' + leadId),
            contacts: (lead && lead._embedded && lead._embedded.contacts) || []
          };

          $.ajax({
            url: proxyUrl + '/export?lead_id=' + leadId,
            dataType: 'json',
            headers: { 'X-Widget-Key': widgetKey }
          })
            .done(function (data) {
              payload = data;
              $('#kec-load').prop('disabled', false);

              if (!data.messages_count) {
                self.status('Este lead no tiene mensajes de chat.', 'warn');
                return;
              }

              self.status('');
              self.renderSummary(data);
              $('#kec-actions').show();
            })
            .fail(function (xhr) {
              $('#kec-load').prop('disabled', false);
              self.status(self.errorText(xhr), 'error');
            });
        });
    };

    this.errorText = function (xhr) {
      var body = xhr.responseJSON || {};
      if (xhr.status === 0)   return 'No se pudo contactar el proxy (revisá la URL y el CORS).';
      if (xhr.status === 401) return 'Clave del widget inválida.';
      if (xhr.status === 503) return 'El proxy no está autorizado todavía. Completá el paso de OAuth.';
      return 'Error ' + xhr.status + (body.detail ? ': ' + body.detail : '');
    };

    this.renderSummary = function (data) {
      var parts = [];
      parts.push('<div class="kec-summary__line"><b>' + data.messages_count + '</b> mensajes</div>');
      parts.push('<div class="kec-summary__line">' + data.talks_count +
                 ' conversación' + (data.talks_count === 1 ? '' : 'es') + '</div>');

      var origins = {};
      data.conversations.forEach(function (c) {
        if (c.origin) origins[c.origin] = true;
      });
      var originList = Object.keys(origins);
      if (originList.length) {
        parts.push('<div class="kec-summary__line kec-summary__muted">' +
                   self.esc(originList.join(', ')) + '</div>');
      }

      $('#kec-summary').html(parts.join('')).show();
    };

    // ─── Utilidades de formato ────────────────────────────────────────────────

    this.esc = function (str) {
      return $('<s>').text(str == null ? '' : String(str)).html();
    };

    this.pad = function (n) { return n < 10 ? '0' + n : String(n); };

    this.fmtDate = function (ts) {
      if (!ts) return '';
      var d = new Date(ts * 1000);
      return d.getFullYear() + '-' + self.pad(d.getMonth() + 1) + '-' + self.pad(d.getDate());
    };

    this.fmtTime = function (ts) {
      if (!ts) return '';
      var d = new Date(ts * 1000);
      return self.pad(d.getHours()) + ':' + self.pad(d.getMinutes());
    };

    this.fmtDateTime = function (ts) {
      return ts ? self.fmtDate(ts) + ' ' + self.fmtTime(ts) : '';
    };

    /** Texto del mensaje con prefijo de tipo y adjunto resuelto. */
    this.messageBody = function (m) {
      var prefix = TYPE_LABEL[m.message_type];
      if (typeof prefix === 'undefined') prefix = '[' + m.message_type + ']';

      var pieces = [];
      if (prefix) pieces.push(prefix);
      if (m.text) pieces.push(m.text);
      if (m.attachment && m.attachment.file_name) pieces.push(m.attachment.file_name);
      if (m.attachment && m.attachment.link) pieces.push(m.attachment.link);

      return pieces.join(' ').trim();
    };

    this.authorName = function (m) {
      if (m.author) return m.author;
      return m.direction === 'incoming' ? 'Contacto' : 'Operador';
    };

    this.baseFileName = function () {
      var safe = (leadInfo.name || 'lead')
        .replace(/[^\w\sáéíóúüñÁÉÍÓÚÜÑ-]/g, '')
        .replace(/\s+/g, '-')
        .slice(0, 40);
      return 'conversacion-' + leadInfo.id + '-' + safe;
    };

    this.download = function (content, filename, mime) {
      var blob = new Blob([content], { type: mime + ';charset=utf-8' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    };

    this.headerLines = function () {
      var contactNames = leadInfo.contacts.map(function (c) { return c.name || ('#' + c.id); });
      return [
        'Conversación — Lead #' + leadInfo.id + ' "' + leadInfo.name + '"',
        contactNames.length ? 'Contacto(s): ' + contactNames.join(', ') : null,
        'Mensajes: ' + payload.messages_count +
          '  |  Conversaciones: ' + payload.talks_count,
        'Exportado: ' + self.fmtDateTime(payload.exported_at)
      ].filter(Boolean);
    };

    // ─── Exportadores ─────────────────────────────────────────────────────────

    this.exportTxt = function () {
      var lines = self.headerLines();
      lines.push(new Array(60).join('─'));

      payload.conversations.forEach(function (conv, i) {
        if (payload.conversations.length > 1) {
          lines.push('');
          lines.push('### Conversación ' + (i + 1) + '/' + payload.conversations.length +
                     (conv.origin ? ' — ' + conv.origin : '') +
                     ' (talk ' + conv.talk_id + ')');
          lines.push('');
        }
        conv.messages.forEach(function (m) {
          lines.push('[' + self.fmtDateTime(m.created_at) + '] ' +
                     self.authorName(m) + ': ' + self.messageBody(m));
        });
      });

      self.download(lines.join('\r\n'), self.baseFileName() + '.txt', 'text/plain');
    };

    this.exportCsv = function () {
      var q = function (v) {
        return '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
      };

      var rows = [[
        'talk_id', 'fecha', 'hora', 'direccion', 'autor',
        'canal', 'tipo', 'texto', 'adjunto_nombre', 'adjunto_url'
      ].join(',')];

      payload.conversations.forEach(function (conv) {
        conv.messages.forEach(function (m) {
          rows.push([
            q(conv.talk_id),
            q(self.fmtDate(m.created_at)),
            q(self.fmtTime(m.created_at)),
            q(m.direction === 'incoming' ? 'entrante' : 'saliente'),
            q(self.authorName(m)),
            q(m.origin || conv.origin),
            q(m.message_type),
            q(m.text),
            q(m.attachment ? m.attachment.file_name : ''),
            q(m.attachment ? m.attachment.link : '')
          ].join(','));
        });
      });

      // BOM para que Excel detecte UTF-8.
      self.download('\ufeff' + rows.join('\r\n'), self.baseFileName() + '.csv', 'text/csv');
    };

    this.exportJson = function () {
      var out = {
        lead: leadInfo,
        exported_at: payload.exported_at,
        talks_count: payload.talks_count,
        messages_count: payload.messages_count,
        conversations: payload.conversations
      };
      self.download(JSON.stringify(out, null, 2), self.baseFileName() + '.json', 'application/json');
    };

    this.exportPdf = function () {
      var win = window.open('', '_blank');
      if (!win) {
        self.status('El navegador bloqueó la ventana de impresión.', 'error');
        return;
      }

      var html = [
        '<!doctype html><html lang="es"><head><meta charset="utf-8">',
        '<title>' + self.esc(self.baseFileName()) + '</title>',
        '<style>',
        'body{font:13px/1.5 -apple-system,Segoe UI,Roboto,sans-serif;color:#2e3f52;',
        '     max-width:760px;margin:32px auto;padding:0 24px;}',
        'h1{font-size:18px;margin:0 0 4px;}',
        '.meta{color:#8a94a0;font-size:12px;margin-bottom:24px;}',
        '.conv-title{font-size:13px;font-weight:600;margin:28px 0 12px;',
        '            padding-bottom:6px;border-bottom:1px solid #e3e7ec;}',
        '.msg{margin:0 0 10px;display:flex;gap:10px;page-break-inside:avoid;}',
        '.msg time{color:#a8b0ba;font-size:11px;white-space:nowrap;flex-shrink:0;',
        '          width:96px;padding-top:2px;}',
        '.bubble{padding:7px 11px;border-radius:8px;max-width:520px;}',
        '.in .bubble{background:#f1f3f6;}',
        '.out .bubble{background:#e4f0ff;}',
        '.who{font-weight:600;font-size:11px;display:block;margin-bottom:2px;color:#5a6875;}',
        '.body{white-space:pre-wrap;word-break:break-word;}',
        '@media print{body{margin:0;}}',
        '</style></head><body>'
      ];

      html.push('<h1>' + self.esc(leadInfo.name) + '</h1>');
      html.push('<div class="meta">' +
        self.headerLines().slice(1).map(self.esc).join('<br>') + '</div>');

      payload.conversations.forEach(function (conv, i) {
        if (payload.conversations.length > 1) {
          html.push('<div class="conv-title">Conversación ' + (i + 1) +
                    (conv.origin ? ' — ' + self.esc(conv.origin) : '') + '</div>');
        }
        conv.messages.forEach(function (m) {
          var cls = m.direction === 'incoming' ? 'in' : 'out';
          html.push(
            '<div class="msg ' + cls + '">' +
              '<time>' + self.esc(self.fmtDateTime(m.created_at)) + '</time>' +
              '<div class="bubble">' +
                '<span class="who">' + self.esc(self.authorName(m)) + '</span>' +
                '<span class="body">' + self.esc(self.messageBody(m)) + '</span>' +
              '</div>' +
            '</div>'
          );
        });
      });

      html.push('</body></html>');

      win.document.write(html.join(''));
      win.document.close();
      win.focus();
      // Pequeña espera para que el layout se asiente antes de abrir el diálogo.
      setTimeout(function () { win.print(); }, 300);
    };

    return this;
  };

  return CustomWidget;
});
