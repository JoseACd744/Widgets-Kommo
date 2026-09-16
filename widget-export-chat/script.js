define(['jquery'], function ($) {
  var CustomWidget = function () {
    var self = this;

    var ROOT_ID = 'kec-root';
    var MAX_BULK_LEADS = 30;    // tope de leads por exportación masiva
    var BULK_CONCURRENCY = 3;   // llamadas simultáneas al proxy/API en modo masivo
    var FIELD_PREFS_KEY = 'kec_field_prefs_v1';

    // Campos estándar, siempre disponibles (no son custom_fields_values).
    var LEAD_BASE_FIELDS = [
      { key: 'lead:name',             label: 'Nombre' },
      { key: 'lead:price',            label: 'Presupuesto' },
      { key: 'lead:created_at',       label: 'Fecha de creación' },
      { key: 'lead:closed_at',        label: 'Fecha de cierre' },
      { key: 'lead:tags',             label: 'Etiquetas' },
      { key: 'lead:responsible_user', label: 'Responsable' },
      { key: 'lead:pipeline_status',  label: 'Embudo / Estado' }
    ];
    var CONTACT_BASE_FIELDS = [
      { key: 'contact:name', label: 'Nombre' }
    ];

    // 'single' (tarjeta de un lead) | 'bulk' (varios leads desde la lista).
    self.mode = 'single';
    self.bulkLeadIds = [];
    // Uno o más registros cargados, reutilizados por el botón de exportación.
    self.records = [];
    // Catálogo de custom fields de la cuenta (independiente de qué leads se
    // cargaron), para que el checklist ofrezca TODOS los campos, no solo los
    // que tienen valor en el lead actual. Se trae una sola vez.
    self.fieldCatalog = { lead: null, contact: null };

    this.callbacks = {
      settings: function () { return true; },
      init:     function () { self.loadCSS(); return true; },
      bind_actions: function () { return true; },

      // La acción masiva de la lista de leads es la de siempre: declarar
      // llist/llist-0 y usar self.list_selected(). No aparece como ícono en
      // la fila principal de la barra — Kommo la agrega dentro del menú
      // "···más" (aparece cuando hay más acciones de las que entran en la
      // fila). Desde ahí abre el panel de widgets nativo (el mismo que usa la
      // tarjeta) y llama a render()/leads.selected.
      render: function () {
        if (APP.data.is_card && APP.data.current_entity === 'leads') {
          self.mount();
          return true;
        }

        if (APP.data.current_entity === 'leads') {
          var sel = self.readListSelection();
          if (sel) self.mountBulk(sel.ids, { truncated: sel.truncated });
        }

        return true;
      },

      leads: {
        selected: function () {
          var sel = self.readListSelection();
          if (sel) self.mountBulk(sel.ids, { truncated: sel.truncated });
          return true;
        }
      },

      onSave:  function () { return true; },
      destroy: function () {}
    };

    // ─── Montaje del panel ────────────────────────────────────────────────────

    this.mount = function () {
      self.mode = 'single';

      // Según la versión, Kommo renderiza templates/widget.twig por su cuenta o
      // usa el HTML que se le pasa en `render`. Se le pasa el shell y después se
      // comprueba que haya quedado montado; si no, se inyecta a mano.
      self.render_template({
        caption: { class_name: 'kec-widget' },
        body: '',
        render: self.shellHtml()
      });

      // bindActions delega desde #kec-root (no desde document), así que
      // necesita que el nodo ya exista — se hace en el mismo tick que
      // ensureMounted, después de que el DOM se haya asentado.
      setTimeout(function () {
        self.ensureMounted();
        self.bindActions();
      }, 0);
    };

    this.mountBulk = function (leadIds, opts) {
      opts = opts || {};
      self.mode = 'bulk';
      self.bulkLeadIds = leadIds;
      self.records = [];

      self.render_template({
        caption: { class_name: 'kec-widget' },
        body: '',
        render: self.shellHtml({ bulk: true, count: leadIds.length })
      });

      setTimeout(self.bindActions, 0);

      if (opts.truncated) {
        self.status('Se seleccionaron más de ' + MAX_BULK_LEADS + ' leads; se usarán los primeros ' + MAX_BULK_LEADS + '.', 'warn');
      }
    };

    /**
     * Kommo adjunta style.css automáticamente en la tarjeta, pero no siempre
     * lo hace en el panel de widgets que se abre desde la lista — se carga a
     * mano para cubrir ambos casos (con guarda para no duplicar el <link>).
     */
    this.loadCSS = function () {
      var settings = self.get_settings() || {};
      if (!settings.path) return;
      var href = settings.path + '/style.css?v=' + settings.version;
      if ($('link[href="' + href + '"]').length) return;
      $('head').append('<link href="' + href + '" type="text/css" rel="stylesheet">');
    };

    /** Lee la selección actual de la lista de leads, si existe (self.list_selected). */
    this.readListSelection = function () {
      var listData = (typeof self.list_selected === 'function')
        ? self.list_selected()
        : (typeof APP.list_selected === 'function' ? APP.list_selected() : null);

      var items = (listData && listData.selected) || [];
      var ids = items.map(function (it) { return it.id; }).filter(Boolean);
      if (!ids.length) return null;

      var truncated = ids.length > MAX_BULK_LEADS;
      if (truncated) ids = ids.slice(0, MAX_BULK_LEADS);

      return { ids: ids, truncated: truncated };
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

    /**
     * Todo se delega desde #kec-root (NO desde document). Kommo tiene su
     * propio listener de "clic afuera" en document para cerrar el panel de
     * widgets; verificado en vivo que cualquier clic dentro del panel que
     * llegue a burbujear hasta document dispara ese cierre — incluso en
     * contenido nuestro, dinámico (los checkboxes del checklist se generan
     * después del montaje inicial). Delegando desde la raíz del propio widget
     * y cortando la propagación ahí (mousedown/click) el evento nunca llega a
     * document, pero nuestros propios handlers —al estar en el mismo nodo—
     * siguen disparando con normalidad.
     */
    this.bindActions = function () {
      var $root = $('#' + ROOT_ID);

      $root.off('.kec')
        .on('click.kec',  '#kec-load', function () { self.load(); })
        .on('click.kec',  '#kec-csv',  function () { self.exportCsv(); })
        .on('click.kec',  '.kec-fields__toggle', function () { self.toggleAllFields($(this).data('target')); })
        .on('change.kec', '.kec-field-checkbox', function () { self.onFieldCheckboxChange($(this)); })
        .on('mousedown.kec click.kec', function (e) { e.stopPropagation(); });
    };

    this.shellHtml = function (opts) {
      opts = opts || {};

      var intro = opts.bulk
        ? '<div class="kec-bulk-note">' + opts.count + ' lead' + (opts.count === 1 ? '' : 's') +
          ' seleccionado' + (opts.count === 1 ? '' : 's') + '</div>'
        : '';
      var loadLabel = opts.bulk ? 'Cargar conversaciones' : 'Cargar conversación';

      return '' +
        '<div id="' + ROOT_ID + '" class="kec">' +
          intro +
          '<div class="kec-section">' +
            '<div class="kec-section__title">Rango de fechas</div>' +
            '<div class="kec-daterange">' +
              '<label class="kec-daterange__field">Desde' +
                '<input type="date" id="kec-date-from" class="kec-date">' +
              '</label>' +
              '<label class="kec-daterange__field">Hasta' +
                '<input type="date" id="kec-date-to" class="kec-date">' +
              '</label>' +
            '</div>' +
            '<div class="kec-hint">Opcional — sin fechas se descarga todo el historial.</div>' +
          '</div>' +
          '<button type="button" id="kec-load" class="kec-btn kec-btn--primary">' + loadLabel + '</button>' +
          '<div id="kec-status" class="kec-status"></div>' +
          '<div id="kec-summary" class="kec-summary" style="display:none;"></div>' +
          '<div id="kec-fields" class="kec-fields" style="display:none;">' +
            '<div class="kec-fields__group">' +
              '<div class="kec-fields__title">' +
                '<span>Campos del lead</span>' +
                '<button type="button" class="kec-fields__toggle" data-target="kec-fields-lead">Marcar/Desmarcar todo</button>' +
              '</div>' +
              '<div id="kec-fields-lead" class="kec-fields__list"></div>' +
            '</div>' +
            '<div class="kec-fields__group">' +
              '<div class="kec-fields__title">' +
                '<span>Campos del contacto</span>' +
                '<button type="button" class="kec-fields__toggle" data-target="kec-fields-contact">Marcar/Desmarcar todo</button>' +
              '</div>' +
              '<div id="kec-fields-contact" class="kec-fields__list"></div>' +
            '</div>' +
          '</div>' +
          '<div id="kec-actions" class="kec-actions" style="display:none;">' +
            '<button type="button" id="kec-csv" class="kec-btn kec-btn--primary">Descargar CSV / Excel</button>' +
          '</div>' +
        '</div>';
    };

    this.status = function (msg, kind) {
      $('#kec-status')
        .attr('class', 'kec-status' + (kind ? ' kec-status--' + kind : ''))
        .text(msg || '');
    };

    // ─── Rango de fechas ──────────────────────────────────────────────────────

    /** Convierte un input type=date (YYYY-MM-DD, hora local) a timestamp unix. */
    this.dateToTs = function (value, endOfDay) {
      if (!value) return 0;
      var parts = value.split('-');
      var d = new Date(
        Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]),
        endOfDay ? 23 : 0, endOfDay ? 59 : 0, endOfDay ? 59 : 0
      );
      return Math.floor(d.getTime() / 1000);
    };

    this.readDateRange = function () {
      return {
        from: self.dateToTs($('#kec-date-from').val(), false),
        to:   self.dateToTs($('#kec-date-to').val(), true)
      };
    };

    // ─── Carga de datos ───────────────────────────────────────────────────────

    this.load = function () {
      if (self.mode === 'bulk') self.loadBulk();
      else self.loadSingle();
    };

    /** Trae lead + contactos (con sus campos) + conversación de UN lead. */
    this.loadOne = function (leadId, range, done) {
      var settings = self.get_settings() || {};
      var proxyUrl = (settings.proxy_url || '').replace(/\/+$/, '');
      var widgetKey = settings.widget_key || '';

      // El nombre del lead, sus custom fields y sus contactos sí se pueden leer
      // con la sesión del navegador: solo /talks/{id}/messages está limitado por
      // scope y pasa por el proxy.
      $.ajax({ url: '/api/v4/leads/' + leadId + '?with=contacts,tags', dataType: 'json' })
        .always(function (lead) {
          var leadOk = !!(lead && lead.id);
          var contactIds = (leadOk && lead._embedded && lead._embedded.contacts || [])
            .map(function (c) { return c.id; })
            .filter(Boolean);

          self.fetchContacts(contactIds, function (contacts) {
            var exportUrl = proxyUrl + '/export?lead_id=' + leadId;
            if (range.from) exportUrl += '&from=' + range.from;
            if (range.to)   exportUrl += '&to=' + range.to;

            $.ajax({
              url: exportUrl,
              dataType: 'json',
              headers: { 'X-Widget-Key': widgetKey }
            })
              .done(function (payload) {
                done(null, {
                  leadId: leadId,
                  leadName: (leadOk && lead.name) || ('Lead #' + leadId),
                  leadFields: leadOk ? self.buildLeadFieldRows(lead) : [],
                  contacts: contacts.map(function (c) {
                    return {
                      id: c.id,
                      name: c.name || ('#' + c.id),
                      fields: self.buildContactFieldRows(c)
                    };
                  }),
                  payload: payload
                });
              })
              .fail(function (xhr) {
                done(self.errorText(xhr), null);
              });
          });
        });
    };

    /** Trae los contactos completos (con custom_fields_values) por id. */
    this.fetchContacts = function (ids, done) {
      if (!ids.length) { done([]); return; }

      var results = [];
      var pending = ids.length;

      ids.forEach(function (id) {
        $.ajax({ url: '/api/v4/contacts/' + id, dataType: 'json' })
          .always(function (contact) {
            if (contact && contact.id) results.push(contact);
            pending--;
            if (pending === 0) done(results);
          });
      });
    };

    this.loadSingle = function () {
      var settings = self.get_settings() || {};
      if (!settings.proxy_url || !settings.widget_key) {
        self.status('Falta configurar la URL del proxy y la clave en los ajustes del widget.', 'error');
        return;
      }

      var leadId = APP.data.current_card.id;
      var range = self.readDateRange();

      $('#kec-load').prop('disabled', true);
      $('#kec-actions').hide();
      $('#kec-summary').hide();
      $('#kec-fields').hide();
      self.status('Cargando conversación…');

      self.loadOne(leadId, range, function (err, record) {
        $('#kec-load').prop('disabled', false);

        if (err) {
          self.status(err, 'error');
          return;
        }

        self.records = [record];
        self.status(record.payload.messages_count ? '' : 'Este lead no tiene mensajes de chat en el rango indicado.',
                    record.payload.messages_count ? null : 'warn');

        self.renderSummary(self.records);
        self.renderFields();
        $('#kec-actions').show();
      });
    };

    this.loadBulk = function () {
      var settings = self.get_settings() || {};
      if (!settings.proxy_url || !settings.widget_key) {
        self.status('Falta configurar la URL del proxy y la clave en los ajustes del widget.', 'error');
        return;
      }

      var ids = self.bulkLeadIds || [];
      if (!ids.length) {
        self.status('No hay leads seleccionados.', 'warn');
        return;
      }

      var range = self.readDateRange();

      $('#kec-load').prop('disabled', true);
      $('#kec-actions').hide();
      $('#kec-summary').hide();
      $('#kec-fields').hide();

      self.records = [];
      var errors = [];
      var total = ids.length;
      var doneCount = 0;
      var next = 0;

      self.status('Cargando lead 0/' + total + '…');

      function pump() {
        if (next >= total) return;
        var leadId = ids[next++];

        self.loadOne(leadId, range, function (err, record) {
          doneCount++;
          if (err) errors.push('#' + leadId + ': ' + err);
          else self.records.push(record);

          if (doneCount < total) {
            self.status('Cargando lead ' + doneCount + '/' + total + '…');
            pump();
          } else {
            finish();
          }
        });
      }

      function finish() {
        $('#kec-load').prop('disabled', false);

        if (!self.records.length) {
          self.status('No se pudo cargar ningún lead.' + (errors.length ? ' ' + errors[0] : ''), 'error');
          return;
        }

        if (errors.length) {
          self.status(self.records.length + ' de ' + total + ' leads cargados (' + errors.length + ' con error).', 'warn');
        } else {
          self.status('');
        }

        self.renderSummary(self.records);
        self.renderFields();
        $('#kec-actions').show();
      }

      for (var i = 0; i < Math.min(BULK_CONCURRENCY, total); i++) pump();
    };

    this.errorText = function (xhr) {
      var body = xhr.responseJSON || {};
      if (xhr.status === 0)   return 'No se pudo contactar el proxy (revisá la URL y el CORS).';
      if (xhr.status === 401) return 'Clave del widget inválida.';
      if (xhr.status === 503) return 'El proxy no está autorizado todavía. Completá el paso de OAuth.';
      return 'Error ' + xhr.status + (body.detail ? ': ' + body.detail : '');
    };

    this.renderSummary = function (records) {
      var totalMsgs = 0;
      var totalTalks = 0;
      var origins = {};

      records.forEach(function (r) {
        totalMsgs += r.payload.messages_count || 0;
        totalTalks += r.payload.talks_count || 0;
        (r.payload.conversations || []).forEach(function (c) {
          if (c.origin) origins[c.origin] = true;
        });
      });

      var parts = [];
      if (records.length > 1) {
        parts.push('<div class="kec-summary__line"><b>' + records.length + '</b> leads cargados</div>');
      }
      parts.push('<div class="kec-summary__line"><b>' + totalMsgs + '</b> mensajes</div>');
      parts.push('<div class="kec-summary__line">' + totalTalks +
                 (totalTalks === 1 ? ' conversación' : ' conversaciones') + '</div>');

      var originList = Object.keys(origins);
      if (originList.length) {
        parts.push('<div class="kec-summary__line kec-summary__muted">' +
                   self.esc(originList.join(', ')) + '</div>');
      }

      $('#kec-summary').html(parts.join('')).show();
    };

    // ─── Campos de lead / contacto ────────────────────────────────────────────

    this.resolveUserName = function (id) {
      if (!id) return '';
      try {
        var users = APP.constant('users');
        if (users && users[id] && users[id].name) return users[id].name;
      } catch (e) { /* no disponible en esta versión de Kommo */ }
      return '#' + id;
    };

    this.resolvePipelineStatus = function (pipelineId, statusId) {
      try {
        var pipelines = APP.constant('pipelines');
        var p = pipelines && pipelines[pipelineId];
        if (p) {
          var status = p.statuses && p.statuses[statusId];
          return (p.name || ('#' + pipelineId)) + ' / ' + (status && status.name ? status.name : ('#' + statusId));
        }
      } catch (e) { /* no disponible en esta versión de Kommo */ }
      return 'Embudo #' + pipelineId + ' / Estado #' + statusId;
    };

    this.joinFieldValues = function (values) {
      if (!values) return '';
      return values.map(function (v) {
        if (v == null) return '';
        return typeof v.value !== 'undefined' ? v.value : String(v);
      }).join(', ');
    };

    this.buildLeadFieldRows = function (lead) {
      var valueByKey = {
        'lead:name':             lead.name || '',
        'lead:price':            lead.price != null ? String(lead.price) : '',
        'lead:created_at':       self.fmtDateTime(lead.created_at),
        'lead:closed_at':        self.fmtDateTime(lead.closed_at),
        'lead:tags':             ((lead._embedded && lead._embedded.tags) || [])
                                    .map(function (t) { return t.name; }).join(', '),
        'lead:responsible_user': self.resolveUserName(lead.responsible_user_id),
        'lead:pipeline_status':  self.resolvePipelineStatus(lead.pipeline_id, lead.status_id)
      };

      var rows = LEAD_BASE_FIELDS.map(function (f) {
        return { key: f.key, label: f.label, value: valueByKey[f.key] || '' };
      });

      (lead.custom_fields_values || []).forEach(function (cf) {
        rows.push({
          key: 'lead:cf:' + cf.field_id,
          label: cf.field_name || ('Campo #' + cf.field_id),
          value: self.joinFieldValues(cf.values)
        });
      });

      return rows;
    };

    this.buildContactFieldRows = function (contact) {
      var rows = CONTACT_BASE_FIELDS.map(function (f) {
        return { key: f.key, label: f.label, value: contact.name || '' };
      });

      (contact.custom_fields_values || []).forEach(function (cf) {
        rows.push({
          key: 'contact:cf:' + cf.field_id,
          label: cf.field_name || ('Campo #' + cf.field_id),
          value: self.joinFieldValues(cf.values)
        });
      });

      return rows;
    };

    /** Trae una página del catálogo de custom fields de la cuenta (leads o contacts). */
    this.fetchFieldCatalogPage = function (entity, page, acc, done) {
      var url = '/api/v4/' + entity + '/custom_fields?limit=250&page=' + page;
      $.ajax({ url: url, dataType: 'json' })
        .done(function (data) {
          var items = (data && data._embedded && data._embedded.custom_fields) || [];
          acc = acc.concat(items);
          if (items.length === 250) self.fetchFieldCatalogPage(entity, page + 1, acc, done);
          else done(acc);
        })
        .fail(function () { done(acc); });
    };

    /** Trae (una sola vez, cacheado) el catálogo completo de campos de lead y de contacto. */
    this.ensureFieldCatalog = function (done) {
      if (self.fieldCatalog.lead && self.fieldCatalog.contact) {
        done();
        return;
      }

      var pending = 2;
      function checkDone() { if (--pending === 0) done(); }

      self.fetchFieldCatalogPage('leads', 1, [], function (items) {
        self.fieldCatalog.lead = items;
        checkDone();
      });
      self.fetchFieldCatalogPage('contacts', 1, [], function (items) {
        self.fieldCatalog.contact = items;
        checkDone();
      });
    };

    this.loadFieldPrefs = function () {
      try {
        return JSON.parse(localStorage.getItem(FIELD_PREFS_KEY)) || {};
      } catch (e) {
        return {};
      }
    };

    this.saveFieldPrefs = function (prefs) {
      try { localStorage.setItem(FIELD_PREFS_KEY, JSON.stringify(prefs)); } catch (e) { /* localStorage no disponible */ }
    };

    this.onFieldCheckboxChange = function ($checkbox) {
      var prefs = self.loadFieldPrefs();
      prefs[$checkbox.data('key')] = $checkbox.is(':checked');
      self.saveFieldPrefs(prefs);
    };

    this.toggleAllFields = function (targetId) {
      var $boxes = $('#' + targetId).find('.kec-field-checkbox');
      if (!$boxes.length) return;

      var next = $boxes.filter(':checked').length !== $boxes.length;
      var prefs = self.loadFieldPrefs();
      $boxes.each(function () {
        $(this).prop('checked', next);
        prefs[$(this).data('key')] = next;
      });
      self.saveFieldPrefs(prefs);
    };

    this.fieldChecklistHtml = function (map, prefs) {
      var keys = Object.keys(map);
      if (!keys.length) return '<div class="kec-fields__empty">Sin campos disponibles.</div>';

      return keys.map(function (key) {
        var checked = prefs[key] !== false; // marcado por defecto
        var id = 'kec-field-' + key.replace(/[^a-zA-Z0-9_-]/g, '_');
        return (
          '<label class="kec-fields__item" for="' + id + '">' +
            '<input type="checkbox" class="kec-field-checkbox" id="' + id + '" data-key="' + self.esc(key) + '"' +
              (checked ? ' checked' : '') + '>' +
            '<span>' + self.esc(map[key]) + '</span>' +
          '</label>'
        );
      }).join('');
    };

    /**
     * Arma el checklist con TODOS los campos disponibles en la cuenta
     * (catálogo), no solo los que tienen valor cargado en los leads/contactos
     * actuales, marcados por defecto.
     */
    this.renderFields = function () {
      self.ensureFieldCatalog(function () {
        var leadMap = {};
        var contactMap = {};

        LEAD_BASE_FIELDS.forEach(function (f) { leadMap[f.key] = f.label; });
        (self.fieldCatalog.lead || []).forEach(function (cf) {
          leadMap['lead:cf:' + cf.id] = cf.name;
        });

        CONTACT_BASE_FIELDS.forEach(function (f) { contactMap[f.key] = f.label; });
        (self.fieldCatalog.contact || []).forEach(function (cf) {
          contactMap['contact:cf:' + cf.id] = cf.name;
        });

        var prefs = self.loadFieldPrefs();
        $('#kec-fields-lead').html(self.fieldChecklistHtml(leadMap, prefs));
        $('#kec-fields-contact').html(self.fieldChecklistHtml(contactMap, prefs));
        $('#kec-fields').show();
      });
    };

    this.selectedFieldKeys = function () {
      var keys = {};
      $('.kec-field-checkbox:checked').each(function () { keys[$(this).data('key')] = true; });
      return keys;
    };

    /** Filas "etiqueta: valor" de un record, según los campos marcados en el checklist. */
    this.recordFieldRows = function (record, selectedKeys) {
      var rows = [];

      record.leadFields.forEach(function (f) {
        if (selectedKeys[f.key]) rows.push({ label: 'Lead — ' + f.label, value: f.value });
      });
      record.contacts.forEach(function (c) {
        c.fields.forEach(function (f) {
          if (selectedKeys[f.key]) rows.push({ label: 'Contacto (' + c.name + ') — ' + f.label, value: f.value });
        });
      });

      return rows;
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

    this.authorName = function (m) {
      if (m.author) return m.author;
      return m.direction === 'incoming' ? 'Contacto' : 'Operador';
    };

    this.baseFileName = function () {
      if (self.records.length === 1) {
        var r = self.records[0];
        var safe = (r.leadName || 'lead')
          .replace(/[^\w\sáéíóúüñÁÉÍÓÚÜÑ-]/g, '')
          .replace(/\s+/g, '-')
          .slice(0, 40);
        return 'conversacion-' + r.leadId + '-' + safe;
      }

      var now = new Date();
      return 'conversaciones-' + self.records.length + '-leads-' +
        now.getFullYear() + self.pad(now.getMonth() + 1) + self.pad(now.getDate());
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

    // ─── Exportador ───────────────────────────────────────────────────────────
    // Itera self.records (un elemento en modo tarjeta, N en modo masivo).

    this.exportCsv = function () {
      var selectedKeys = self.selectedFieldKeys();
      var multi = self.records.length > 1;
      var q = function (v) {
        return '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
      };

      var fieldLines = [];
      self.records.forEach(function (record) {
        var rows = self.recordFieldRows(record, selectedKeys);
        if (!rows.length) return;
        if (multi) fieldLines.push(q('Lead #' + record.leadId + ' — ' + record.leadName) + ',');
        rows.forEach(function (f) { fieldLines.push(q(f.label) + ',' + q(f.value)); });
        fieldLines.push('');
      });

      var out = [];
      if (fieldLines.length) {
        out.push(q('campo') + ',' + q('valor'));
        out = out.concat(fieldLines);
        out.push('');
      }

      var header = ['talk_id', 'fecha', 'hora', 'direccion', 'autor',
                     'canal', 'tipo', 'texto', 'adjunto_nombre', 'adjunto_url'];
      if (multi) header = ['lead_id', 'lead_name'].concat(header);
      out.push(header.map(q).join(','));

      self.records.forEach(function (record) {
        record.payload.conversations.forEach(function (conv) {
          conv.messages.forEach(function (m) {
            var row = [
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
            ];
            if (multi) row = [q(record.leadId), q(record.leadName)].concat(row);
            out.push(row.join(','));
          });
        });
      });

      // BOM para que Excel detecte UTF-8.
      self.download('﻿' + out.join('\r\n'), self.baseFileName() + '.csv', 'text/csv');
    };

    return this;
  };

  return CustomWidget;
});
