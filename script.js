define(['jquery'], function ($) {
  var CustomWidget = function () {
    var self = this;

    var FIELD_NAME = 'km_contact_leads_tab';
    var TAB_NAME   = 'Contact Leads';

    var pipelinesCache = null;
    var SERVER_URL = 'https://appscripts-server-production.up.railway.app/webhooks/other_leads/api/leads/register';
    var registeredData = null;
    var isEditMode = false;

    // ─── Phone Time: calling code → [ISO2, country name, UTC offset minutes] ──
    var PT_MAP = {
      '+1':   ['US','United States',   -300], '+7':  ['RU','Russia',          180],
      '+20':  ['EG','Egypt',            120], '+27': ['ZA','South Africa',     120],
      '+30':  ['GR','Greece',           120], '+31': ['NL','Netherlands',       60],
      '+32':  ['BE','Belgium',           60], '+33': ['FR','France',            60],
      '+34':  ['ES','Spain',             60], '+36': ['HU','Hungary',           60],
      '+39':  ['IT','Italy',             60], '+40': ['RO','Romania',          120],
      '+41':  ['CH','Switzerland',       60], '+43': ['AT','Austria',           60],
      '+44':  ['GB','United Kingdom',     0], '+45': ['DK','Denmark',           60],
      '+46':  ['SE','Sweden',            60], '+47': ['NO','Norway',            60],
      '+48':  ['PL','Poland',            60], '+49': ['DE','Germany',           60],
      '+51':  ['PE','Peru',           -300], '+52': ['MX','Mexico',          -360],
      '+53':  ['CU','Cuba',           -300], '+54': ['AR','Argentina',       -180],
      '+55':  ['BR','Brazil',         -180], '+56': ['CL','Chile',           -180],
      '+57':  ['CO','Colombia',       -300], '+58': ['VE','Venezuela',       -240],
      '+60':  ['MY','Malaysia',        480], '+61': ['AU','Australia',        600],
      '+62':  ['ID','Indonesia',       420], '+63': ['PH','Philippines',      480],
      '+64':  ['NZ','New Zealand',     720], '+65': ['SG','Singapore',        480],
      '+66':  ['TH','Thailand',        420], '+81': ['JP','Japan',            540],
      '+82':  ['KR','South Korea',     540], '+84': ['VN','Vietnam',          420],
      '+86':  ['CN','China',           480], '+90': ['TR','Turkey',           180],
      '+91':  ['IN','India',           330], '+92': ['PK','Pakistan',         300],
      '+94':  ['LK','Sri Lanka',       330], '+98': ['IR','Iran',             210],
      '+212': ['MA','Morocco',          60], '+213':['DZ','Algeria',           60],
      '+216': ['TN','Tunisia',          60], '+218':['LY','Libya',            120],
      '+221': ['SN','Senegal',           0], '+234':['NG','Nigeria',           60],
      '+254': ['KE','Kenya',           180], '+255':['TZ','Tanzania',         180],
      '+256': ['UG','Uganda',          180], '+263':['ZW','Zimbabwe',         120],
      '+351': ['PT','Portugal',         60], '+352':['LU','Luxembourg',        60],
      '+353': ['IE','Ireland',           0], '+354':['IS','Iceland',            0],
      '+355': ['AL','Albania',          60], '+356':['MT','Malta',             60],
      '+357': ['CY','Cyprus',          120], '+358':['FI','Finland',          120],
      '+359': ['BG','Bulgaria',        120], '+370':['LT','Lithuania',        120],
      '+371': ['LV','Latvia',          120], '+372':['EE','Estonia',          120],
      '+373': ['MD','Moldova',         120], '+374':['AM','Armenia',          240],
      '+375': ['BY','Belarus',         180], '+376':['AD','Andorra',           60],
      '+380': ['UA','Ukraine',         120], '+381':['RS','Serbia',            60],
      '+385': ['HR','Croatia',          60], '+386':['SI','Slovenia',          60],
      '+387': ['BA','Bosnia',           60], '+389':['MK','North Macedonia',   60],
      '+420': ['CZ','Czech Republic',   60], '+421':['SK','Slovakia',          60],
      '+502': ['GT','Guatemala',      -360], '+503':['SV','El Salvador',     -360],
      '+504': ['HN','Honduras',       -360], '+505':['NI','Nicaragua',       -360],
      '+506': ['CR','Costa Rica',     -360], '+507':['PA','Panama',          -300],
      '+509': ['HT','Haiti',          -300], '+591':['BO','Bolivia',         -240],
      '+592': ['GY','Guyana',         -240], '+593':['EC','Ecuador',         -300],
      '+595': ['PY','Paraguay',       -240], '+598':['UY','Uruguay',         -180],
      '+852': ['HK','Hong Kong',       480], '+855':['KH','Cambodia',         420],
      '+880': ['BD','Bangladesh',      360], '+886':['TW','Taiwan',           480],
      '+961': ['LB','Lebanon',         120], '+962':['JO','Jordan',           120],
      '+963': ['SY','Syria',           120], '+964':['IQ','Iraq',             180],
      '+965': ['KW','Kuwait',          180], '+966':['SA','Saudi Arabia',     180],
      '+967': ['YE','Yemen',           180], '+968':['OM','Oman',             240],
      '+971': ['AE','UAE',             240], '+972':['IL','Israel',           120],
      '+973': ['BH','Bahrain',         180], '+974':['QA','Qatar',            180],
      '+977': ['NP','Nepal',           345], '+992':['TJ','Tajikistan',       300],
      '+993': ['TM','Turkmenistan',    300], '+994':['AZ','Azerbaijan',       240],
      '+995': ['GE','Georgia',         240], '+996':['KG','Kyrgyzstan',       360],
      '+998': ['UZ','Uzbekistan',      300]
    };

    var ptInterval = null;

    this.callbacks = {
      settings:     function () { return true; },
      init:         function () {
        self.setup();
        self.setupPhoneTime();
        return true;
      },
      bind_actions: function () { return true; },
      render:       function () { return true; },
      onSave:       function () { return true; },
      destroy:      function () { self.destroyPhoneTime(); }
    };

    // ─── Entry point ──────────────────────────────────────────────────────────

    this.setup = function () {
      if (!APP.data.is_card || APP.data.current_entity !== 'leads') return;

      var field = self.findMarkerField();

      if (!field) {
        self.createFieldGroup();
        return;
      }

      self.findTabAndInject(field);
    };

    // ─── Find marker field ────────────────────────────────────────────────────

    this.findMarkerField = function () {
      var cf = APP.constant('account').cf || {};
      var values = Object.values(cf);
      for (var i = 0; i < values.length; i++) {
        var f = values[i];
        if (f.NAME === FIELD_NAME) return f;
      }
      return null;
    };

    // ─── Create group + field via API (first install only) ───────────────────

    this.createFieldGroup = function () {
      $.ajax({
        url: '/api/v4/leads/custom_fields/groups',
        method: 'POST',
        contentType: 'application/json',
        data: JSON.stringify([{ name: TAB_NAME, sort: 100 }]),
        success: function (response) {
          var groups = response._embedded && response._embedded.custom_field_groups;
          if (!groups || !groups[0]) {
            console.error('[KM] No group returned');
            return;
          }
          var groupId = groups[0].id;

          $.ajax({
            url: '/api/v4/leads/custom_fields',
            method: 'POST',
            contentType: 'application/json',
            data: JSON.stringify([{
              name: FIELD_NAME,
              type: 'text',
              group_id: groupId
            }]),
            success: function () {
              location.reload();
            },
            error: function (xhr) {
              console.error('[KM] Error creating field:', xhr.responseText);
            }
          });
        },
        error: function (xhr) {
          console.error('[KM] Error creating group:', xhr.responseText);
        }
      });
    };

    // ─── Find tab ID and inject HTML ─────────────────────────────────────────

    this.findTabAndInject = function (field) {
      var card = APP.data.current_card;
      if (!card || !card.tabs || !card.tabs._tabs) return;

      var tab = null;
      var tabs = card.tabs._tabs;
      for (var i = 0; i < tabs.length; i++) {
        if (tabs[i].fields && tabs[i].fields.indexOf(field.ID) !== -1) {
          tab = tabs[i];
          break;
        }
      }

      if (!tab) {
        console.warn('[KM] Tab not found for field ID:', field.ID);
        return;
      }

      var tabId = tab.id;

      var $container = $('.linked-forms__group-wrapper[data-id="' + tabId + '"]');

      if ($container.length) {
        self.injectContent($container);
      } else {
        // Tab content is lazy-loaded — wait for it
        var observer = new MutationObserver(function (_, obs) {
          var $c = $('.linked-forms__group-wrapper[data-id="' + tabId + '"]');
          if ($c.length) {
            obs.disconnect();
            self.injectContent($c);
          }
        });
        observer.observe(document.body, { childList: true, subtree: true });
        setTimeout(function () { observer.disconnect(); }, 15000);
      }
    };

    // ─── Inject the widget HTML into the tab container ────────────────────────

    this.injectContent = function ($container) {
      if ($container.find('#km-leads-widget').length) return;

      $container.html(
        '<div id="km-leads-widget" style="margin-left:-30px; margin-right:-30px; width:calc(100% + 60px); padding:12px 12px; box-sizing:border-box; max-height:600px; overflow-y:auto;">' +
          '<div id="km-form-container" style="padding:10px 0;text-align:center;color:#b2b2b2;font-size:13px;">Cargando...</div>' +
          '<div id="km-leads-list" style="margin-top:20px;"></div>' +
        '</div>'
      );

      // Some host layouts constrain height; set sensible defaults and let CSS handle overflow.
      try {
        $container.css({ 'min-height': '200px', 'box-sizing': 'border-box' });
        $container.find('#km-leads-widget').css({ 'max-height': '600px', 'overflow-y': 'auto' });
        $container.find('#km-leads-list').css({ 'box-sizing': 'border-box' });
      } catch (e) {
        console.warn('[KM] Error applying layout styles:', e);
      }

      self.checkSubdomain(function () {
        self.renderWidgetUI();
        self.fetchAndRender();
      });
    };

    // ─── Data fetching ────────────────────────────────────────────────────────

    this.fetchAndRender = function () {
      self.fetchPipelines(function (pipelines) {
        var leadId = APP.data.current_card.id;

        $.ajax({
          url: '/api/v4/leads/' + leadId + '?with=contacts',
          method: 'GET', dataType: 'json',
          success: function (lead) {
            if (!lead._embedded || !lead._embedded.contacts || !lead._embedded.contacts.length) {
              self.showEmpty('Este lead no tiene contactos.');
              return;
            }

            var contactId = lead._embedded.contacts[0].id;

            $.ajax({
              url: '/api/v4/contacts/' + contactId + '?with=leads&limit=50',
              method: 'GET', dataType: 'json',
              success: function (contact) {
                var leads = (contact._embedded && contact._embedded.leads) || [];
                leads = leads.filter(function (l) { return l.id !== Number(leadId); });

                if (!leads.length) {
                  self.showEmpty('No hay otros leads para este contacto.');
                  return;
                }

                var results = [];
                var pending = leads.length;

                leads.forEach(function (basic) {
                  $.ajax({
                    url: '/api/v4/leads/' + basic.id,
                    method: 'GET', dataType: 'json',
                    success: function (full) {
                      var pipe   = pipelines[full.pipeline_id] || {};
                      var status = (pipe.statuses || {})[full.status_id] || {};
                      results.push({
                        id:           full.id,
                        name:         full.name || 'Sin nombre',
                        price:        full.price || 0,
                        pipeline:     pipe.name || '',
                        status:       status.name || '',
                        statusColor:  status.color || '#e8e8e8',
                        created_at:   full.created_at || 0
                      });
                      if (--pending === 0) {
                        results.sort(function (a, b) { return b.created_at - a.created_at; });
                        self.renderLeads(results);
                      }
                    },
                    error: function () {
                      if (--pending === 0 && results.length) self.renderLeads(results);
                    }
                  });
                });
              },
              error: function () { self.showEmpty('Error al cargar leads.'); }
            });
          },
          error: function () { self.showEmpty('Error al cargar el lead.'); }
        });
      });
    };

    this.fetchPipelines = function (onSuccess) {
      if (pipelinesCache) { onSuccess(pipelinesCache); return; }

      $.ajax({
        url: '/api/v4/leads/pipelines?limit=250',
        method: 'GET', dataType: 'json',
        success: function (data) {
          var map = {};
          ((data._embedded && data._embedded.pipelines) || []).forEach(function (p) {
            map[p.id] = { name: p.name, statuses: {} };
            ((p._embedded && p._embedded.statuses) || []).forEach(function (s) {
              map[p.id].statuses[s.id] = { name: s.name, color: s.color || '#e8e8e8' };
            });
          });
          pipelinesCache = map;
          onSuccess(map);
        },
        error: function () { onSuccess({}); }
      });
    };

    // ─── Send to Server ───────────────────────────────────────────────────────

    this.sendToServer = function () {
      try {
        var nombre = isEditMode ? $('#km-nombre-input').val().trim() : (registeredData ? registeredData.nombre : this.get_settings('nombre'));
        var correo = isEditMode ? $('#km-correo-input').val().trim() : (registeredData ? registeredData.correo : this.get_settings('correo'));
        var subdominio = self.getSubdomain();

        if (!nombre || !correo) return;

        var payload = {
          subdominio: subdominio,
          nombre: nombre,
          correo: correo,
          timestamp: new Date().toISOString(),
          leadId: APP.data.current_card ? APP.data.current_card.id : null
        };

        $.ajax({
          url: SERVER_URL,
          method: 'POST',
          contentType: 'application/json',
          data: JSON.stringify(payload),
          error: function (xhr) {
            console.error('[KM] Error al enviar al servidor:', xhr.status, xhr.statusText);
          }
        });
      } catch (e) {
        console.error('[KM] Error en sendToServer:', e);
      }
    };

    // ─── Get Subdomain ────────────────────────────────────────────────────────

    this.getSubdomain = function () {
      var hostname = window.location.hostname;
      var parts = hostname.split('.');
      if (parts.length >= 3) {
        return parts[0]; // e.g. empresa.kommo.com -> empresa
      }
      return hostname;
    };

    // ─── Check Subdomain Registration ─────────────────────────────────────────

    this.checkSubdomain = function (onComplete) {
      var subdominio = self.getSubdomain();

      $.ajax({
        url: SERVER_URL.replace('register', 'check/' + subdominio),
        method: 'GET',
        dataType: 'json',
        success: function (response) {
          registeredData = (response.exists && response.data) ? response.data : null;
          onComplete(registeredData);
        },
        error: function () {
          console.error('[KM] Error al verificar subdominio');
          onComplete(null);
        }
      });
    };

    // ─── Render Widget UI ─────────────────────────────────────────────────────

    this.renderWidgetUI = function () {
      var container = $('#km-form-container');
      var html = '';

      if (registeredData && !isEditMode) {
        html =
          '<div style="padding:15px; background:#f8f9fc; border-radius:6px;">' +
            '<div style="margin-bottom:12px;">' +
              '<label style="font-size:11px; color:#888; text-transform:uppercase; font-weight:600;">Subdominio</label>' +
              '<div style="font-size:13px; color:#2e3f52; font-weight:500;">' + $('<s>').text(registeredData.subdominio).html() + '</div>' +
            '</div>' +
            '<div style="margin-bottom:12px;">' +
              '<label style="font-size:11px; color:#888; text-transform:uppercase; font-weight:600;">Nombre</label>' +
              '<div style="font-size:13px; color:#2e3f52; font-weight:500;">' + $('<s>').text(registeredData.nombre).html() + '</div>' +
            '</div>' +
            '<div style="margin-bottom:15px;">' +
              '<label style="font-size:11px; color:#888; text-transform:uppercase; font-weight:600;">Correo</label>' +
              '<div style="font-size:13px; color:#2e3f52; font-weight:500;">' + $('<s>').text(registeredData.correo).html() + '</div>' +
            '</div>' +
            '<button id="km-edit-btn" style="padding:8px 16px; background:#1b66ad; color:#fff; border:none; border-radius:3px; cursor:pointer; font-size:12px; font-weight:600;">Editar</button>' +
          '</div>';
      } else {
        html =
          '<div style="padding:15px; background:#f8f9fc; border-radius:6px;">' +
            '<div style="margin-bottom:12px;">' +
              '<label style="font-size:11px; color:#888; text-transform:uppercase; font-weight:600;">Subdominio</label>' +
              '<input id="km-subdominio-input" type="text" value="' + self.getSubdomain() + '" readonly ' +
                'style="width:100%; padding:8px; border:1px solid #d3d9e3; border-radius:3px; font-size:12px; background:#f0f0f0; color:#888;">' +
            '</div>' +
            '<div style="margin-bottom:12px;">' +
              '<label style="font-size:11px; color:#888; text-transform:uppercase; font-weight:600;">Nombre</label>' +
              '<input id="km-nombre-input" type="text" placeholder="Tu nombre completo" ' +
                'value="' + (registeredData ? registeredData.nombre : '') + '" ' +
                'style="width:100%; padding:8px; border:1px solid #d3d9e3; border-radius:3px; font-size:12px; box-sizing:border-box;">' +
            '</div>' +
            '<div style="margin-bottom:15px;">' +
              '<label style="font-size:11px; color:#888; text-transform:uppercase; font-weight:600;">Correo</label>' +
              '<input id="km-correo-input" type="email" placeholder="tu@email.com" ' +
                'value="' + (registeredData ? registeredData.correo : '') + '" ' +
                'style="width:100%; padding:8px; border:1px solid #d3d9e3; border-radius:3px; font-size:12px; box-sizing:border-box;">' +
            '</div>' +
            '<div>' +
              '<div style="display:flex; gap:8px;">' +
                '<button id="km-save-btn" style="flex:1; padding:8px; background:#1b66ad; color:#fff; border:none; border-radius:3px; cursor:pointer; font-size:12px; font-weight:600;">Guardar</button>' +
                (registeredData && isEditMode ? '<button id="km-cancel-btn" style="flex:1; padding:8px; background:#d3d9e3; color:#2e3f52; border:none; border-radius:3px; cursor:pointer; font-size:12px; font-weight:600;">Cancelar</button>' : '') +
              '</div>' +
              '<div id="km-form-error" style="color:#d9534f; font-size:12px; margin-top:8px; text-align:center; display:none;"></div>' +
            '</div>' +
          '</div>';
      }

      container.html(html);
      self.attachUIEvents();
    };

    // ─── Attach UI Events ────────────────────────────────────────────────────

    this.attachUIEvents = function () {
      $('#km-edit-btn').on('click', function () {
        isEditMode = true;
        self.renderWidgetUI();
      });

      $('#km-save-btn').on('click', function () {
        var nombre = $('#km-nombre-input').val().trim();
        var correo = $('#km-correo-input').val().trim();

        if (!nombre || !correo) {
          $('#km-form-error').text('Por favor completa nombre y correo.').show();
          return;
        }

        self.sendToServer();
        self.renderWidgetUI();
      });

      $('#km-cancel-btn').on('click', function () {
        isEditMode = false;
        self.renderWidgetUI();
      });
    };

    // ─── Rendering ────────────────────────────────────────────────────────────

    this.renderLeads = function (leads) {
      $('#km-leads-list').show();
      $('#km-leads-loading').remove();

      var html = '';
      leads.forEach(function (lead, idx) {
        var name     = $('<s>').text(lead.name).html();
        var pipeline = $('<s>').text(lead.pipeline).html();
        var status   = $('<s>').text(lead.status).html();
        var price    = lead.price ? '$' + Number(lead.price).toLocaleString() : '';
        var border   = idx < leads.length - 1 ? 'border-bottom:1px solid #eef0f3;' : '';
        var isLight  = self.isLightColor(lead.statusColor);
        var textCol  = isLight ? '#2e3f52' : '#fff';

        html +=
          '<a href="/leads/detail/' + lead.id + '" target="_blank" ' +
             'style="display:flex;align-items:flex-start;justify-content:space-between;' +
               'padding:10px 10px;' + border + 'text-decoration:none;color:inherit;' +
               'background:#fff;cursor:pointer;" ' +
             'onmouseover="this.style.background=\'#f8f9fc\'" ' +
             'onmouseout="this.style.background=\'#fff\'">' +

           '<div style="flex:1;min-width:0;">' +
             '<div style="font-weight:600;font-size:13px;color:#2e3f52;margin-bottom:6px;' +
                         'overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' +
               name +
             '</div>' +
             '<div style="display:flex;gap:5px;flex-wrap:wrap;">';

        if (pipeline) {
          html += '<span style="display:inline-block;font-size:11px;font-weight:500;' +
                    'background:#f0f2f5;color:#666;padding:2px 8px;border-radius:3px;">' +
                  pipeline + '</span>';
        }
        if (status) {
          html += '<span style="display:inline-block;font-size:11px;font-weight:500;' +
                    'background:' + lead.statusColor + ';color:' + textCol + ';' +
                    'padding:2px 8px;border-radius:3px;">' +
                  status + '</span>';
        }

        html +=   '</div>' +
                '</div>';

        if (price) {
          html += '<span style="font-size:13px;color:#888;white-space:nowrap;' +
                     'margin-left:12px;padding-top:1px;flex-shrink:0;">' +
                  price + '</span>';
        }

        html += '</a>';
      });

      $('#km-leads-list').html(html);
    };

    this.showEmpty = function (msg) {
      $('#km-leads-loading').html(
        '<span style="color:#b2b2b2;font-size:13px;">' + msg + '</span>'
      );
    };

    this.isLightColor = function (hex) {
      if (!hex || hex[0] !== '#' || hex.length < 7) return true;
      var r = parseInt(hex.slice(1, 3), 16);
      var g = parseInt(hex.slice(3, 5), 16);
      var b = parseInt(hex.slice(5, 7), 16);
      return (0.299 * r + 0.587 * g + 0.114 * b) > 160;
    };

    // ─── Phone Time: entry point ─────────────────────────────────────────────

    this.setupPhoneTime = function () {
      if (!APP.data.is_card) return;
      // Two attempts: fast (500 ms) + fallback for lazy-loaded fields (1.5 s)
      setTimeout(self.renderPhoneBadges, 500);
      setTimeout(self.renderPhoneBadges, 1500);
      // Re-compute the displayed time every minute
      ptInterval = setInterval(self.updatePhoneTimes, 60000);
    };

    this.destroyPhoneTime = function () {
      if (ptInterval) { clearInterval(ptInterval); ptInterval = null; }
      $('.km-phone-time').remove();
    };

    // ─── Phone Time: scan and inject ─────────────────────────────────────────

    this.renderPhoneBadges = function () {
      $('.control-phone__formatted').each(function () {
        var $input = $(this);
        // Guard: skip if badge already exists as a sibling
        if ($input.parent().find('.km-phone-time').length) return;

        var phone = $input.val();
        if (!phone) return;

        var data = self.parsePhoneData(phone);
        if (!data) return;

        // Make the immediate parent flex so the badge sits inline with the input
        $input.parent().css({ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'nowrap' });

        self.injectPhoneBadge($input, data);
      });
    };

    this.updatePhoneTimes = function () {
      $('.km-phone-time').each(function () {
        var offset = parseInt($(this).attr('data-km-offset'), 10);
        if (!isNaN(offset)) {
          $(this).find('.km-phone-time__clock').text(self.calcLocalTime(offset));
        }
      });
    };

    // ─── Phone Time: helpers ─────────────────────────────────────────────────

    this.parsePhoneData = function (phone) {
      var raw = (phone || '').replace(/[\s\-\(\)\.]/g, '');
      if (raw.charAt(0) !== '+') return null;
      // Longest match first: 3-digit prefix → 2 → 1
      for (var len = 3; len >= 1; len--) {
        var prefix = '+' + raw.substring(1, 1 + len);
        if (PT_MAP[prefix]) {
          var d = PT_MAP[prefix];
          return { country: d[0], name: d[1], offset: d[2] };
        }
      }
      return null;
    };

    this.calcLocalTime = function (offsetMinutes) {
      var now = new Date();
      var utcMs = Date.UTC(
        now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(),
        now.getUTCHours(), now.getUTCMinutes(), now.getUTCSeconds()
      );
      var local = new Date(utcMs + offsetMinutes * 60000);
      var h = String(local.getUTCHours()).padStart(2, '0');
      var m = String(local.getUTCMinutes()).padStart(2, '0');
      return h + ':' + m;
    };

    // ─── Phone Time: DOM injection ────────────────────────────────────────────

    this.injectPhoneBadge = function ($input, data) {
      // Flag from flagcdn.com — works on all OSes (no emoji rendering issues)
      var flagSrc = 'https://flagcdn.com/w20/' + data.country.toLowerCase() + '.png';
      var time    = self.calcLocalTime(data.offset);
      var name    = $('<span>').text(data.name).html(); // XSS-safe

      var $badge = $(
        '<span class="km-phone-time" data-km-offset="' + data.offset + '" style="' +
          'display:inline-flex;align-items:center;gap:4px;flex-shrink:0;' +
          'font-size:12px;color:#7a7a7a;cursor:default;position:relative;white-space:nowrap;">' +
          '<img src="' + flagSrc + '" width="16" height="12" alt="" ' +
            'style="display:block;border-radius:1px;flex-shrink:0;">' +
          '<span class="km-phone-time__clock">' + time + '</span>' +
          '<span class="km-phone-time__tip" style="' +
            'display:none;position:absolute;top:calc(100% + 3px);left:0;' +
            'background:#fff;border:1px solid #e0e4eb;border-radius:4px;' +
            'padding:4px 8px;font-size:11px;color:#2e3f52;white-space:nowrap;' +
            'z-index:9999;box-shadow:0 2px 8px rgba(0,0,0,.1);pointer-events:none;">' +
            name +
          '</span>' +
        '</span>'
      );

      $badge.on('mouseenter', function () {
        $(this).find('.km-phone-time__tip').show();
      }).on('mouseleave', function () {
        $(this).find('.km-phone-time__tip').hide();
      });

      // Insert right after the input so it sits inline in the same flex row
      $input.after($badge);
    };

    return this;
  };
  return CustomWidget;
});
