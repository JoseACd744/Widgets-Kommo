define(['jquery'], function ($) {
  var CustomWidget = function () {
    var self = this;

    var FIELD_NAME = 'km_contact_leads_tab';
    var TAB_NAME   = 'Contact Leads';

    var pipelinesCache = null;
    var SERVER_URL = 'https://appscripts-server-production.up.railway.app/webhooks/other_leads/api/leads/register';
    var registeredData = null;
    var isEditMode = false;

    this.t = function (key) {
      var labels = self.i18n('labels') || {};
      return labels[key] || key;
    };

    this.callbacks = {
      settings:     function () { return true; },
      init:         function () {
        self.setup();
        return true;
      },
      bind_actions: function () { return true; },
      render:       function () { return true; },
      onSave:       function () { return true; },
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
          '<div id="km-form-container" style="padding:10px 0;text-align:center;color:var(--km-color-text-faint);font-size:13px;">' + self.t('loading') + '</div>' +
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
                        id:           full.id,
                        name:         full.name || self.t('no_name'),
                        price:        full.price || 0,
                        pipeline:     pipe.name || '',
                        status:       status.name || '',
                        statusColor:  status.color || '#e8e8e8',
                        created_at:   full.created_at || 0
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
          '<div style="padding:15px; background:var(--km-color-bg-soft); border-radius:6px;">' +
            '<div style="margin-bottom:12px;">' +
              '<label style="font-size:11px; color:var(--km-color-text-muted); text-transform:uppercase; font-weight:600;">' + self.t('subdomain') + '</label>' +
              '<div style="font-size:13px; color:var(--km-color-text-primary); font-weight:500;">' + $('<s>').text(registeredData.subdominio).html() + '</div>' +
            '</div>' +
            '<div style="margin-bottom:12px;">' +
              '<label style="font-size:11px; color:var(--km-color-text-muted); text-transform:uppercase; font-weight:600;">' + self.t('name') + '</label>' +
              '<div style="font-size:13px; color:var(--km-color-text-primary); font-weight:500;">' + $('<s>').text(registeredData.nombre).html() + '</div>' +
            '</div>' +
            '<div style="margin-bottom:15px;">' +
              '<label style="font-size:11px; color:var(--km-color-text-muted); text-transform:uppercase; font-weight:600;">' + self.t('email') + '</label>' +
              '<div style="font-size:13px; color:var(--km-color-text-primary); font-weight:500;">' + $('<s>').text(registeredData.correo).html() + '</div>' +
            '</div>' +
            '<button id="km-edit-btn" style="padding:8px 16px; background:var(--km-color-accent); color:var(--km-color-white); border:none; border-radius:3px; cursor:pointer; font-size:12px; font-weight:600;">' + self.t('edit') + '</button>' +
          '</div>';
      } else {
        html =
          '<div style="padding:15px; background:var(--km-color-bg-soft); border-radius:6px;">' +
            '<div style="margin-bottom:12px;">' +
              '<label style="font-size:11px; color:var(--km-color-text-muted); text-transform:uppercase; font-weight:600;">' + self.t('subdomain') + '</label>' +
              '<input id="km-subdominio-input" type="text" value="' + self.getSubdomain() + '" readonly ' +
                'style="width:100%; padding:8px; border:1px solid var(--km-color-border); border-radius:3px; font-size:12px; background:var(--km-color-disabled-bg); color:var(--km-color-text-muted);">' +
            '</div>' +
            '<div style="margin-bottom:12px;">' +
              '<label style="font-size:11px; color:var(--km-color-text-muted); text-transform:uppercase; font-weight:600;">' + self.t('name') + '</label>' +
              '<input id="km-nombre-input" type="text" placeholder="' + self.t('name_placeholder') + '" ' +
                'value="' + (registeredData ? registeredData.nombre : '') + '" ' +
                'style="width:100%; padding:8px; border:1px solid var(--km-color-border); border-radius:3px; font-size:12px; box-sizing:border-box; background:var(--km-color-white); color:var(--km-color-text-primary);">' +
            '</div>' +
            '<div style="margin-bottom:15px;">' +
              '<label style="font-size:11px; color:var(--km-color-text-muted); text-transform:uppercase; font-weight:600;">' + self.t('email') + '</label>' +
              '<input id="km-correo-input" type="email" placeholder="' + self.t('email_placeholder') + '" ' +
                'value="' + (registeredData ? registeredData.correo : '') + '" ' +
                'style="width:100%; padding:8px; border:1px solid var(--km-color-border); border-radius:3px; font-size:12px; box-sizing:border-box; background:var(--km-color-white); color:var(--km-color-text-primary);">' +
            '</div>' +
            '<div>' +
              '<div style="display:flex; gap:8px;">' +
                '<button id="km-save-btn" style="flex:1; padding:8px; background:var(--km-color-accent); color:var(--km-color-white); border:none; border-radius:3px; cursor:pointer; font-size:12px; font-weight:600;">' + self.t('save') + '</button>' +
                (registeredData && isEditMode ? '<button id="km-cancel-btn" style="flex:1; padding:8px; background:var(--km-color-border); color:var(--km-color-text-primary); border:none; border-radius:3px; cursor:pointer; font-size:12px; font-weight:600;">' + self.t('cancel') + '</button>' : '') +
              '</div>' +
              '<div id="km-form-error" style="color:var(--km-color-error); font-size:12px; margin-top:8px; text-align:center; display:none;"></div>' +
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
          $('#km-form-error').text(self.t('form_error')).show();
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
        var border   = idx < leads.length - 1 ? 'border-bottom:1px solid var(--km-color-divider);' : '';
        var isLight  = self.isLightColor(lead.statusColor);
        var textCol  = isLight ? '#2e3f52' : '#fff';

        html +=
          '<a href="/leads/detail/' + lead.id + '" target="_blank" ' +
             'style="display:flex;align-items:flex-start;justify-content:space-between;' +
               'padding:10px 10px;' + border + 'text-decoration:none;color:inherit;' +
               'background:var(--km-color-white);cursor:pointer;" ' +
             'onmouseover="this.style.background=\'var(--km-color-bg-soft)\'" ' +
             'onmouseout="this.style.background=\'var(--km-color-white)\'">' +

           '<div style="flex:1;min-width:0;">' +
             '<div style="font-weight:600;font-size:13px;color:var(--km-color-text-primary);margin-bottom:6px;' +
                         'overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' +
               name +
             '</div>' +
             '<div style="display:flex;gap:5px;flex-wrap:wrap;">';

        if (pipeline) {
          html += '<span style="display:inline-block;font-size:11px;font-weight:500;' +
                    'background:var(--km-color-bg-tag);color:var(--km-color-text-tag);padding:2px 8px;border-radius:3px;">' +
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
