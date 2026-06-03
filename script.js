define(['jquery'], function ($) {
  var CustomWidget = function () {
    var self = this;

    this.callbacks = {
      settings: function () {
        return true;
      },

      render: function () {
        var settings = self.get_settings();

        // Load CSS
        if ($('link[href*="' + settings.widget_code + '"]').length < 1) {
          $('head').append(
            '<link rel="stylesheet" type="text/css" href="' +
            settings.path + '/style.css?v=' + settings.version + '">'
          );
        }

        // Load twig template then render into sidebar panel
        self.render({
          href: '/templates/widget.twig',
          base_path: self.params.cdn_path,
          load: function (template) {
            self.render_template({
              caption: { class_name: 'js-km-duplicate-caption' },
              body: template.render({}),
              render: ''
            });
          }
        }, {});

        return true;
      },

      init: function () {
        // DOM is ready (render ran first) — load data
        self.loadCurrentLeadData();
        self.loadPipelines();
        return true;
      },

      bind_actions: function () {
        $(document).on('change', '#km-dl-pipeline', function () {
          var pid = $(this).val();
          var $status = $('#km-dl-status');
          $('#km-dl-btn').prop('disabled', true);

          if (!pid) {
            $status.prop('disabled', true)
              .empty()
              .append('<option value="">Primero selecciona un pipeline</option>');
            return;
          }

          $status.prop('disabled', true)
            .empty()
            .append('<option value="">Cargando...</option>');

          $.ajax({
            url: '/api/v4/leads/pipelines/' + pid + '/statuses',
            method: 'GET',
            dataType: 'json',
            success: function (data) {
              $status.empty().append('<option value="">Seleccionar status...</option>');
              var statuses = (data._embedded && data._embedded.statuses) || [];
              statuses.forEach(function (s) {
                $status.append(
                  '<option value="' + s.id + '">' +
                  $('<span>').text(s.name).html() +
                  '</option>'
                );
              });
              $status.prop('disabled', false);
            },
            error: function () {
              $status.empty().append('<option value="">Error cargando status</option>');
            }
          });
        });

        $(document).on('change', '#km-dl-status', function () {
          var pid = $('#km-dl-pipeline').val();
          var sid = $(this).val();
          $('#km-dl-btn').prop('disabled', !(pid && sid));
        });

        $(document).on('click', '#km-dl-btn', function () {
          var pid = $('#km-dl-pipeline').val();
          var sid = $('#km-dl-status').val();
          if (pid && sid) {
            self.duplicateLead(pid, sid);
          }
        });

        return true;
      },

      onSave: function () {
        return true;
      },

      destroy: function () {
        $(document).off('change', '#km-dl-pipeline');
        $(document).off('change', '#km-dl-status');
        $(document).off('click', '#km-dl-btn');
      }
    };

    this.loadCurrentLeadData = function () {
      var leadId = APP.data.current_card.id;
      var $info = $('#km-dl-info');
      $info.show().html('<p style="color:#999">Cargando...</p>');

      $.ajax({
        url: '/api/v4/leads/' + leadId + '?with=contacts',
        method: 'GET',
        dataType: 'json',
        success: function (data) {
          self._leadData = data;
          var name  = $('<span>').text(data.name || 'Sin nombre').html();
          var price = data.price !== undefined ? '$' + data.price : 'N/A';
          $info.html(
            '<p><strong>' + name + '</strong></p>' +
            '<p>Precio: ' + price + '</p>'
          );
        },
        error: function () {
          $info.html('<p style="color:red">Error cargando lead</p>');
        }
      });
    };

    this.loadPipelines = function () {
      $.ajax({
        url: '/api/v4/leads/pipelines',
        method: 'GET',
        dataType: 'json',
        success: function (data) {
          var $select = $('#km-dl-pipeline');
          $select.empty().append('<option value="">Seleccionar pipeline...</option>');
          var pipelines = (data._embedded && data._embedded.pipelines) || [];
          pipelines.forEach(function (p) {
            $select.append(
              '<option value="' + p.id + '">' +
              $('<span>').text(p.name).html() +
              '</option>'
            );
          });
        },
        error: function () {
          $('#km-dl-pipeline').empty().append('<option value="">Error cargando</option>');
        }
      });
    };

    this.duplicateLead = function (pipelineId, statusId) {
      var lead = self._leadData;
      if (!lead) return;

      var $btn = $('#km-dl-btn');
      $btn.prop('disabled', true).text('Duplicando...');

      var newLead = {
        name: lead.name + ' (Copia)',
        status_id: parseInt(statusId),
        pipeline_id: parseInt(pipelineId),
        _embedded: {}
      };

      if (lead._embedded && lead._embedded.contacts && lead._embedded.contacts.length) {
        var contacts = lead._embedded.contacts;
        var main = null;
        for (var i = 0; i < contacts.length; i++) {
          if (contacts[i].is_main) { main = contacts[i]; break; }
        }
        if (!main) main = contacts[0];
        if (main) {
          newLead._embedded.contacts = [{ id: main.id, is_main: true }];
        }
      }

      $.ajax({
        url: '/api/v4/leads',
        method: 'POST',
        contentType: 'application/json',
        dataType: 'json',
        data: JSON.stringify([newLead]),
        success: function (res) {
          var newId = res._embedded.leads[0].id;
          self.showToast('Lead duplicado exitosamente. ID: ' + newId, 'success');
          $('#km-dl-pipeline').val('');
          $('#km-dl-status')
            .empty()
            .append('<option value="">Primero selecciona un pipeline</option>')
            .prop('disabled', true);
          $btn.prop('disabled', true).text('Duplicar Lead');
        },
        error: function (xhr) {
          var detail = xhr.responseJSON && xhr.responseJSON.detail;
          self.showToast('Error: ' + (detail || xhr.statusText), 'error');
          $btn.prop('disabled', false).text('Duplicar Lead');
        }
      });
    };

    this.showToast = function (msg, type) {
      var $t = $('#km-dl-toast');
      $t.attr('class', 'km-dl-toast km-dl-toast--' + type).text(msg).show();
      setTimeout(function () { $t.hide(); }, 3500);
    };

    return this;
  };

  return CustomWidget;
});
