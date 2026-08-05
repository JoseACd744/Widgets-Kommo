define(['jquery'], function ($) {
  var CustomWidget = function () {
    var self = this;

    var FIELD_NAME = 'km_contact_leads_tab';
    var TAB_NAME   = 'Contact Leads';

    var pipelinesCache = null;
    var SERVER_URL = 'https://appscripts-server-production.up.railway.app/webhooks/other_leads/api/leads/register';
    var CHECK_URL  = 'https://appscripts-server-production.up.railway.app/webhooks/other_leads/api/leads/check/';

    this.t = function (key) {
      var labels = self.i18n('labels') || {};
      return labels[key] || key;
    };

    this.tAdv = function (key) {
      var adv = self.i18n('advanced') || {};
      return adv[key] || key;
    };

    this.callbacks = {
      settings:     function () { return true; },
      init:         function () {
        self.setup();
        return true;
      },
      bind_actions: function () { return true; },
      render:       function () { return true; },
      onSave:       function () {
        self.sendToServer();
        return true;
      },
      advancedSettings: function () {
        self.renderAdvancedSettings();
        return true;
      },
      destroy:      function () {}
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
            error: function () {}
          });
        },
        error: function () {}
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

    // ─── Inline styles ────────────────────────────────────────────────────────
    // Kommo does not reliably serve style.css for this widget (confirmed: the
    // file is uploaded and reachable on their CDN, but no <link> ever gets
    // added to the page). Inject the same rules ourselves so the widget never
    // depends on that pipeline.

    this.injectStyles = function () {
      if (document.getElementById('km-leads-widget-styles')) return;

      var css =
        '#km-leads-widget {' +
          '--km-color-white:#ffffff;--km-color-bg-soft:#f8f9fc;--km-color-bg-tag:#f0f2f5;' +
          '--km-color-border:#d3d9e3;--km-color-divider:#c3cad6;--km-color-disabled-bg:#f0f0f0;' +
          '--km-color-text-primary:#2e3f52;--km-color-text-muted:#888888;--km-color-text-faint:#b2b2b2;' +
          '--km-color-text-tag:#666666;--km-color-accent:#1b66ad;--km-color-error:#d9534f;' +
        '}' +
        ':root[data-color-scheme="dark"] #km-leads-widget {' +
          '--km-color-white:#1c2530;--km-color-bg-soft:#232e3c;--km-color-bg-tag:#2b3846;' +
          '--km-color-border:#3a4553;--km-color-divider:#4d5a6b;--km-color-disabled-bg:#2a3542;' +
          '--km-color-text-primary:#eef1f5;--km-color-text-muted:#9aa7b5;--km-color-text-faint:#7c8a99;' +
          '--km-color-text-tag:#c3ccd6;--km-color-accent:#4b8fd6;--km-color-error:#e2665d;' +
        '}';

      var style = document.createElement('style');
      style.id = 'km-leads-widget-styles';
      style.textContent = css;
      document.head.appendChild(style);
    };

    // ─── Inject the widget HTML into the tab container ────────────────────────

    this.injectContent = function ($container) {
      if ($container.find('#km-leads-widget').length) return;

      self.injectStyles();

      $container.html(
        '<div id="km-leads-widget" style="margin-left:-30px; margin-right:-30px; width:calc(100% + 60px); padding:12px 12px; box-sizing:border-box; max-height:600px; overflow-y:auto;">' +
          '<div id="km-leads-loading" style="padding:10px 0;text-align:center;color:var(--km-color-text-faint);font-size:13px;">' + self.t('loading') + '</div>' +
          '<div id="km-leads-list" style="margin-top:20px;display:none;"></div>' +
        '</div>'
      );

      // Some host layouts constrain height; set sensible defaults and let CSS handle overflow.
      try {
        $container.css({ 'min-height': '200px', 'box-sizing': 'border-box' });
        $container.find('#km-leads-widget').css({ 'max-height': '600px', 'overflow-y': 'auto' });
        $container.find('#km-leads-list').css({ 'box-sizing': 'border-box' });
      } catch {}

      self.fetchAndRender();
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
              self.showEmpty(self.t('no_contacts'));
              return;
            }

            var contactId = lead._embedded.contacts[0].id;

            $.ajax({
              url: '/api/v4/contacts/' + contactId + '?with=leads&limit=50',
              method: 'GET', dataType: 'json',
              success: function (contact) {
                var basics = (contact._embedded && contact._embedded.leads) || [];
                var leadIds = basics
                  .map(function (l) { return l.id; })
                  .filter(function (id) { return id !== Number(leadId); });

                if (!leadIds.length) {
                  self.showEmpty(self.t('no_other_leads'));
                  return;
                }

                var filterQuery = leadIds.map(function (id) { return 'filter[id][]=' + id; }).join('&');

                $.ajax({
                  url: '/api/v4/leads?' + filterQuery + '&limit=250',
                  method: 'GET', dataType: 'json',
                  success: function (data) {
                    var fulls = (data._embedded && data._embedded.leads) || [];
                    var results = fulls.map(function (full) {
                      var pipe   = pipelines[full.pipeline_id] || {};
                      var status = (pipe.statuses || {})[full.status_id] || {};
                      return {
                        id:            full.id,
                        name:          full.name || self.t('no_name'),
                        price:         full.price || 0,
                        pipeline:      pipe.name || '',
                        status:        status.name || '',
                        statusColor:   status.color || '#e8e8e8',
                        created_at:    full.created_at || 0,
                        customFields:  full.custom_fields_values || []
                      };
                    });
                    results.sort(function (a, b) { return b.created_at - a.created_at; });
                    self.renderLeads(results);
                  },
                  error: function () { self.showEmpty(self.t('error_leads')); }
                });
              },
              error: function () { self.showEmpty(self.t('error_leads')); }
            });
          },
          error: function () { self.showEmpty(self.t('error_lead')); }
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

    // ─── Check Registered ─────────────────────────────────────────────────────

    this.checkRegistered = function (subdominio, callback) {
      $.ajax({
        url: CHECK_URL + encodeURIComponent(subdominio),
        method: 'GET',
        dataType: 'json',
        success: function (response) {
          callback(!!(response && (response.registered || response.exists)));
        },
        error: function () {
          // Fail-open: un problema del endpoint de chequeo no debe bloquear el registro.
          callback(false);
        }
      });
    };

    // ─── Send to Server ───────────────────────────────────────────────────────

    this.sendToServer = function () {
      try {
        var nombre = self.get_settings('nombre');
        var correo = self.get_settings('correo');
        var telefono = self.get_settings('telefono');
        var subdominio = self.getSubdomain();

        if (!nombre || !correo || !telefono) return;

        self.checkRegistered(subdominio, function (alreadyRegistered) {
          if (alreadyRegistered) return;

          var payload = {
            subdominio: subdominio,
            nombre: nombre,
            correo: correo,
            telefono: telefono,
            timestamp: new Date().toISOString()
          };

          $.ajax({
            url: SERVER_URL,
            method: 'POST',
            contentType: 'application/json',
            data: JSON.stringify(payload),
            error: function () {}
          });
        });
      } catch {}
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

    // ─── Advanced settings: which fields show on other-leads cards ───────────
    // Stored via self.set_settings() outside the manifest's "settings" schema,
    // so absence of the key (never saved yet) must default to shown (true).

    this.getCardFieldPrefs = function () {
      var settings = self.get_settings() || {};
      var customFieldIds = (settings.visible_custom_fields || '')
        .split(',')
        .map(function (s) { return s.trim(); })
        .filter(Boolean);
      return {
        pipeline:       settings.show_pipeline !== '0',
        status:         settings.show_stage   !== '0',
        price:          settings.show_price   !== '0',
        customFieldIds: customFieldIds
      };
    };

    this.getAdvancedSettingsContainer = function () {
      // #list_page_holder is Kommo's real content container for this page
      // (confirmed via live DOM inspection — it sits right below the page's
      // own "Ajustes avanzados" header, empty until the widget fills it in).
      // The others are defensive fallbacks in case Kommo changes this ID.
      var candidates = [
        '#list_page_holder',
        '.js-advanced-settings',
        '.advanced-settings__body',
        '.widget-advanced-settings',
        '.settings-advanced-page__content'
      ];
      for (var i = 0; i < candidates.length; i++) {
        var $c = $(candidates[i]);
        if ($c.length) return $c;
      }
      return null;
    };

    this.fetchLeadCustomFields = function (onSuccess) {
      $.ajax({
        url: '/api/v4/leads/custom_fields?limit=250',
        method: 'GET', dataType: 'json',
        success: function (data) {
          onSuccess((data._embedded && data._embedded.custom_fields) || []);
        },
        error: function () { onSuccess([]); }
      });
    };

    this.renderAdvancedSettings = function () {
      self.injectStyles();
      self.fetchLeadCustomFields(function (customFields) {
        self.renderAdvancedSettingsContent(customFields);
      });
    };

    this.renderAdvancedSettingsContent = function (customFields) {
      var settings = self.get_settings() || {};
      var prefs = self.getCardFieldPrefs();
      var esc = function (v) { return $('<s>').text(v || '').html(); };

      var customFieldsHtml = customFields.length
        ? customFields.map(function (f) {
            var checked = prefs.customFieldIds.indexOf(String(f.id)) !== -1;
            return '<label class="km-adv-cf-row" style="display:flex;align-items:center;gap:8px;margin-bottom:8px;font-size:13px;' +
                     'color:var(--km-color-text-primary);cursor:pointer;">' +
                     '<input type="checkbox" class="km-adv-custom-field" value="' + f.id + '"' + (checked ? ' checked' : '') + '> ' +
                     esc(f.name) +
                   '</label>';
          }).join('')
        : '<div style="font-size:13px;color:var(--km-color-text-faint);">' + self.tAdv('no_custom_fields') + '</div>';

      var html =
        '<div id="km-leads-widget" style="max-width:560px;padding:24px 30px;box-sizing:border-box;">' +

          '<div style="margin-bottom:28px;">' +
            '<h3 style="font-size:15px;font-weight:600;color:var(--km-color-text-primary);margin:0 0 12px;">' +
              self.tAdv('holos_data_title') +
            '</h3>' +
            '<div style="display:grid;grid-template-columns:130px 1fr;row-gap:8px;font-size:13px;color:var(--km-color-text-primary);">' +
              '<div style="color:var(--km-color-text-muted);">' + self.tAdv('name_label')      + '</div><div>' + esc(settings.nombre)     + '</div>' +
              '<div style="color:var(--km-color-text-muted);">' + self.tAdv('email_label')     + '</div><div>' + esc(settings.correo)     + '</div>' +
              '<div style="color:var(--km-color-text-muted);">' + self.tAdv('phone_label')     + '</div><div>' + esc(settings.telefono) + '</div>' +
              '<div style="color:var(--km-color-text-muted);">' + self.tAdv('subdomain_label') + '</div><div>' + esc(self.getSubdomain()) + '</div>' +
            '</div>' +
          '</div>' +

          '<div style="margin-bottom:28px;">' +
            '<h3 style="font-size:15px;font-weight:600;color:var(--km-color-text-primary);margin:0 0 12px;">' +
              self.tAdv('card_fields_title') +
            '</h3>' +
            '<label style="display:flex;align-items:center;gap:8px;margin-bottom:10px;font-size:13px;color:var(--km-color-text-primary);cursor:pointer;">' +
              '<input type="checkbox" id="km-adv-show-pipeline"' + (prefs.pipeline ? ' checked' : '') + '> ' + self.tAdv('show_pipeline') +
            '</label>' +
            '<label style="display:flex;align-items:center;gap:8px;margin-bottom:10px;font-size:13px;color:var(--km-color-text-primary);cursor:pointer;">' +
              '<input type="checkbox" id="km-adv-show-stage"' + (prefs.status ? ' checked' : '') + '> ' + self.tAdv('show_stage') +
            '</label>' +
            '<label style="display:flex;align-items:center;gap:8px;margin-bottom:0;font-size:13px;color:var(--km-color-text-primary);cursor:pointer;">' +
              '<input type="checkbox" id="km-adv-show-price"' + (prefs.price ? ' checked' : '') + '> ' + self.tAdv('show_price') +
            '</label>' +
          '</div>' +

          '<div style="margin-bottom:24px;">' +
            '<h3 style="font-size:15px;font-weight:600;color:var(--km-color-text-primary);margin:0 0 12px;">' +
              self.tAdv('custom_fields_title') +
            '</h3>' +
            (customFields.length > 6
              ? '<input type="text" id="km-adv-cf-search" placeholder="' + esc(self.tAdv('search_placeholder')) + '" ' +
                  'style="width:100%;box-sizing:border-box;margin-bottom:8px;padding:7px 10px;font-size:13px;' +
                  'border:1px solid var(--km-color-divider);border-radius:6px;background:var(--km-color-white);' +
                  'color:var(--km-color-text-primary);">'
              : '') +
            '<div style="max-height:240px;overflow-y:auto;border:1px solid var(--km-color-divider);border-radius:6px;padding:12px;">' +
              customFieldsHtml +
              '<div id="km-adv-cf-empty" style="display:none;font-size:13px;color:var(--km-color-text-faint);">' +
                self.tAdv('no_matches') +
              '</div>' +
            '</div>' +
          '</div>' +

          '<div>' +
            '<button id="km-adv-save" style="background:var(--km-color-accent);color:#fff;border:none;border-radius:6px;' +
                    'padding:9px 20px;font-size:13px;font-weight:600;cursor:pointer;">' +
              self.tAdv('save') +
            '</button>' +
            '<span id="km-adv-saved" style="margin-left:12px;font-size:13px;color:var(--km-color-accent);display:none;">' +
              self.tAdv('saved') +
            '</span>' +
          '</div>' +
        '</div>';

      var $container = self.getAdvancedSettingsContainer();
      if ($container) {
        $container.html(html);
      } else {
        $('#km-advanced-settings-fallback').remove();
        $('body').append('<div id="km-advanced-settings-fallback">' + html + '</div>');
      }

      $(document).off('click.kmAdvSave').on('click.kmAdvSave', '#km-adv-save', function () {
        var selectedFieldIds = [];
        $('.km-adv-custom-field:checked').each(function () { selectedFieldIds.push($(this).val()); });

        self.set_settings($.extend({}, self.get_settings(), {
          show_pipeline:         $('#km-adv-show-pipeline').is(':checked') ? '1' : '0',
          show_stage:            $('#km-adv-show-stage').is(':checked')    ? '1' : '0',
          show_price:            $('#km-adv-show-price').is(':checked')    ? '1' : '0',
          visible_custom_fields: selectedFieldIds.join(',')
        }));
        var $saved = $('#km-adv-saved').stop(true, true).show();
        setTimeout(function () { $saved.fadeOut(); }, 2000);
      });

      $(document).off('input.kmAdvCfFilter').on('input.kmAdvCfFilter', '#km-adv-cf-search', function () {
        var query = $(this).val().toLowerCase();
        var visibleCount = 0;
        $('.km-adv-cf-row').each(function () {
          var matches = $(this).text().toLowerCase().indexOf(query) !== -1;
          $(this).toggle(matches);
          if (matches) visibleCount++;
        });
        $('#km-adv-cf-empty').toggle(visibleCount === 0);
      });
    };

    // ─── Rendering ────────────────────────────────────────────────────────────

    this.renderLeads = function (leads) {
      $('#km-leads-list').show();
      $('#km-leads-loading').remove();

      var prefs = self.getCardFieldPrefs();
      var html = '';
      leads.forEach(function (lead, idx) {
        var name     = $('<s>').text(lead.name).html();
        var pipeline = $('<s>').text(lead.pipeline).html();
        var status   = $('<s>').text(lead.status).html();
        var price    = lead.price ? '$' + Number(lead.price).toLocaleString() : '';
        var margin   = idx < leads.length - 1 ? 'margin-bottom:8px;' : '';
        var isLight  = self.isLightColor(lead.statusColor);
        var textCol  = isLight ? '#2e3f52' : '#fff';

        html +=
          '<a href="/leads/detail/' + lead.id + '" target="_blank" ' +
             'style="display:flex;align-items:flex-start;justify-content:space-between;' +
               'padding:10px 10px;border:1px solid var(--km-color-divider);border-radius:6px;' + margin + 'text-decoration:none;color:inherit;' +
               'background:var(--km-color-white);cursor:pointer;" ' +
             'onmouseover="this.style.background=\'var(--km-color-bg-soft)\'" ' +
             'onmouseout="this.style.background=\'var(--km-color-white)\'">' +

           '<div style="flex:1;min-width:0;">' +
             '<div style="font-weight:600;font-size:13px;color:var(--km-color-text-primary);margin-bottom:6px;' +
                         'overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' +
               name +
             '</div>' +
             '<div style="display:flex;gap:5px;flex-wrap:wrap;">';

        if (pipeline && prefs.pipeline) {
          html += '<span style="display:inline-block;font-size:11px;font-weight:500;' +
                    'background:var(--km-color-bg-tag);color:var(--km-color-text-tag);padding:2px 8px;border-radius:3px;">' +
                  pipeline + '</span>';
        }
        if (status && prefs.status) {
          html += '<span style="display:inline-block;font-size:11px;font-weight:500;' +
                    'background:' + lead.statusColor + ';color:' + textCol + ';' +
                    'padding:2px 8px;border-radius:3px;">' +
                  status + '</span>';
        }

        prefs.customFieldIds.forEach(function (fieldId) {
          var field = (lead.customFields || []).filter(function (cf) {
            return String(cf.field_id) === fieldId;
          })[0];
          if (!field) return;

          var value = (field.values || [])
            .map(function (v) { return v.value; })
            .filter(function (v) { return v !== null && v !== undefined && v !== ''; })
            .join(', ');
          if (!value) return;

          var fieldLabel = $('<s>').text(field.field_name || '').html();
          var fieldValue = $('<s>').text(value).html();

          html += '<span style="display:inline-block;font-size:11px;font-weight:500;' +
                    'background:var(--km-color-bg-tag);color:var(--km-color-text-tag);padding:2px 8px;border-radius:3px;">' +
                  fieldLabel + ': ' + fieldValue + '</span>';
        });

        html +=   '</div>' +
                '</div>';

        if (price && prefs.price) {
          html += '<span style="font-size:13px;color:var(--km-color-text-muted);white-space:nowrap;' +
                     'margin-left:12px;padding-top:1px;flex-shrink:0;">' +
                  price + '</span>';
        }

        html += '</a>';
      });

      $('#km-leads-list').html(html);
    };

    this.showEmpty = function (msg) {
      $('#km-leads-loading').html(
        '<span style="color:var(--km-color-text-faint);font-size:13px;">' + msg + '</span>'
      );
    };

    this.isLightColor = function (hex) {
      if (!hex || hex[0] !== '#' || hex.length < 7) return true;
      var r = parseInt(hex.slice(1, 3), 16);
      var g = parseInt(hex.slice(3, 5), 16);
      var b = parseInt(hex.slice(5, 7), 16);
      return (0.299 * r + 0.587 * g + 0.114 * b) > 160;
    };

    return this;
  };
  return CustomWidget;
});
