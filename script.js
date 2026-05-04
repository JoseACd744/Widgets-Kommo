define(['jquery'], function ($) {
  var CustomWidget = function () {
    var self = this;

    // Name of the marker field that identifies our tab
    var FIELD_NAME = 'km_contact_leads_tab';
    var TAB_NAME   = 'Contact Leads';

    var pipelinesCache = null;

    this.callbacks = {
      settings:     function () { return true; },
      init:         function () {
        console.log('[KM] init v1.0.2');
        self.setup();
        return true;
      },
      bind_actions: function () { return true; },
      render:       function () {
        // lcard-1 triggers render — we don't use the right panel,
        // just return true so nothing renders there.
        return true;
      },
      onSave:       function () { return true; },
      destroy:      function () {}
    };

    // ─── Entry point ──────────────────────────────────────────────────────────

    this.setup = function () {
      if (!APP.data.is_card || APP.data.current_entity !== 'leads') return;

      var field = self.findMarkerField();

      if (!field) {
        // First install: create group + marker field, then reload
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
      console.log('[KM] Creating tab group...');

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
          console.log('[KM] Group created, id:', groupId);

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
              console.log('[KM] Marker field created. Reloading...');
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
      console.log('[KM] Found tab id:', tabId);

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
          '<div id="km-leads-loading" style="padding:20px 0;text-align:center;color:#b2b2b2;font-size:13px;">Cargando leads...</div>' +
          '<div id="km-leads-list"></div>' +
        '</div>'
      );

      // Ensure the tab container can grow and allow internal scrolling if needed.
      // Some host layouts constrain height; set sensible defaults and let CSS handle overflow.
      try {
        $container.css({ 'min-height': '200px', 'box-sizing': 'border-box' });
        $container.find('#km-leads-widget').css({ 'max-height': '600px', 'overflow-y': 'auto' });
        $container.find('#km-leads-list').css({ 'box-sizing': 'border-box' });
      } catch (e) {
        console.warn('[KM] Error applying layout styles:', e);
      }

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
            console.log('[KM] lead ok:', lead.id);

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

    // ─── Rendering ────────────────────────────────────────────────────────────

    this.renderLeads = function (leads) {
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

    return this;
  };
  return CustomWidget;
});
