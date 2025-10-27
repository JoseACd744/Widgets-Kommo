define(['jquery'], function ($) {
  var CustomWidget = function () {
    var self = this;
    var currentLeadData = null;
    var pipelines = [];
    var selectedPipeline = null;
    var selectedStatus = null;

    this.callbacks = {
      settings: function () {
        return true;
      },
      init: function () {
        self.loadCSS();
        return true;
      },
      bind_actions: function () {
        // Event listeners para los selectores
        $(document).on('change', '#km-pipeline-select', function() {
          selectedPipeline = $(this).val();
          if (selectedPipeline) {
            self.loadPipelineStatuses(selectedPipeline);
          }
        });

        $(document).on('change', '#km-status-select', function() {
          selectedStatus = $(this).val();
        });

        $(document).on('click', '#km-duplicate-btn', function() {
          if (selectedPipeline && selectedStatus) {
            self.duplicateLead();
          } else {
            self.showSnackbar('Por favor selecciona pipeline y status', 'error');
          }
        });

        return true;
      },
      render: function () {
        self.render_template({
          caption: {
            class_name: 'js-km-caption',
            html: 'Duplicar Lead'
          },
          body: `
            <div id="km-duplicate-container" class="km-duplicate-container">
              <div class="km-form-group">
                <label for="km-pipeline-select">Pipeline:</label>
                <select id="km-pipeline-select" class="km-select">
                  <option value="">Seleccionar pipeline...</option>
                </select>
              </div>
              <div class="km-form-group">
                <label for="km-status-select">Status:</label>
                <select id="km-status-select" class="km-select" disabled>
                  <option value="">Primero selecciona un pipeline</option>
                </select>
              </div>
              <div class="km-form-group">
                <button id="km-duplicate-btn" class="km-btn km-btn-primary" disabled>
                  Duplicar Lead
                </button>
              </div>
              <div id="km-lead-info" class="km-lead-info"></div>
            </div>
            <div id="km-snackbar" class="km-snackbar"></div>
          `,
          render: ''
        });
        
        self.loadCurrentLeadData();
        self.loadPipelines();
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

    this.loadCSS = function() {
      var settings = self.get_settings();
      if ($('link[href="' + settings.path + '/style.css?v=' + settings.version + '"').length < 1) {
        $('head').append('<link href="' + settings.path + '/style.css?v=' + settings.version + '" type="text/css" rel="stylesheet">');
      }
      $('head').append(`<style>
        .km-duplicate-container {
          padding: 15px;
          max-height: 500px;
          overflow-y: auto;
          background-color: #663399;
        }
        .km-form-group {
          margin-bottom: 15px;
        }
        .km-form-group label {
          display: block;
          margin-bottom: 5px;
          font-weight: bold;
          color: #ffffffff;
        }
        .km-select {
          width: 100%;
          padding: 8px 12px;
          border: 1px solid #ddd;
          border-radius: 4px;
          font-size: 14px;
          background-color: #fff;
        }
        .km-select:disabled {
          background-color: #f5f5f5;
          color: #999;
        }
        .km-btn {
          padding: 10px 20px;
          border: none;
          border-radius: 4px;
          font-size: 14px;
          cursor: pointer;
          transition: background-color 0.3s;
        }
        .km-btn-primary {
          background-color: #007cba;
          color: white;
        }
        .km-btn-primary:hover:not(:disabled) {
          background-color: #005a8b;
        }
        .km-btn:disabled {
          background-color: #ccc;
          cursor: not-allowed;
        }
        .km-lead-info {
          margin-top: 20px;
          padding: 15px;
          background-color: #f8f9fa;
          border-radius: 4px;
          border-left: 4px solid #007cba;
        }
        .km-lead-info h4 {
          margin: 0 0 10px 0;
          color: #333;
        }
        .km-lead-info p {
          margin: 5px 0;
          font-size: 14px;
          color: #666;
        }
        .km-snackbar {
          visibility: hidden;
          min-width: 250px;
          margin-left: -125px;
          background-color: #333;
          color: #fff;
          text-align: center;
          border-radius: 4px;
          padding: 16px;
          position: fixed;
          z-index: 1000;
          left: 50%;
          bottom: 30px;
          font-size: 14px;
        }
        .km-snackbar.show {
          visibility: visible;
          animation: fadein 0.5s, fadeout 0.5s 2.5s;
        }
        .km-snackbar.error {
          background-color: #f44336;
        }
        .km-snackbar.success {
          background-color: #4caf50;
        }
        @keyframes fadein {
          from { bottom: 0; opacity: 0; }
          to { bottom: 30px; opacity: 1; }
        }
        @keyframes fadeout {
          from { bottom: 30px; opacity: 1; }
          to { bottom: 0; opacity: 0; }
        }
        .km-loading {
          text-align: center;
          padding: 20px;
          color: #666;
        }
      </style>`);
    };

    this.loadCurrentLeadData = function() {
      var leadId = APP.data.current_card.id;
      console.log('Cargando datos del lead:', leadId);

      $('#km-lead-info').html('<div class="km-loading">Cargando datos del lead...</div>');

      $.ajax({
        url: '/api/v4/leads/' + leadId + '?with=contacts,companies',
        method: 'GET',
        dataType: 'json',
        success: function(data) {
          console.log('Datos del lead obtenidos:', data);
          currentLeadData = data;
          self.displayCurrentLeadInfo(data);
        },
        error: function(error) {
          console.error('Error obteniendo datos del lead:', error);
          self.showSnackbar('Error obteniendo datos del lead: ' + error.statusText, 'error');
          $('#km-lead-info').html('<p style="color: red;">Error cargando datos del lead</p>');
        }
      });
    };

    this.displayCurrentLeadInfo = function(lead) {
      var responsibleUserName = 'No asignado';
      if (lead.responsible_user_id) {
        self.fetchUserName(lead.responsible_user_id, function(userName) {
          responsibleUserName = userName;
          self.updateLeadInfoDisplay(lead, responsibleUserName);
        });
      } else {
        self.updateLeadInfoDisplay(lead, responsibleUserName);
      }
    };

    this.updateLeadInfoDisplay = function(lead, responsibleUserName) {
      var contactsCount = lead._embedded && lead._embedded.contacts ? lead._embedded.contacts.length : 0;
      var companiesCount = lead._embedded && lead._embedded.companies ? lead._embedded.companies.length : 0;
      
      $('#km-lead-info').html(`
        <h4>Datos del Lead a Duplicar:</h4>
        <p><strong>Nombre:</strong> ${lead.name || 'Sin nombre'}</p>
        <p><strong>ID:</strong> ${lead.id}</p>
        <p><strong>Precio:</strong> $${lead.price !== undefined ? lead.price : 'No disponible'}</p>
        <p><strong>Responsable:</strong> ${responsibleUserName}</p>
        <p><strong>Contactos vinculados:</strong> ${contactsCount}</p>
        <p><strong>Empresas vinculadas:</strong> ${companiesCount}</p>
        <p><strong>Campos personalizados:</strong> ${lead.custom_fields_values ? lead.custom_fields_values.length : 0}</p>
      `);
    };

    this.fetchUserName = function(userId, callback) {
      $.ajax({
        url: `/api/v4/users/${userId}`,
        method: 'GET',
        dataType: 'json',
        success: function(user) {
          callback(user.name);
        },
        error: function(error) {
          console.error('Error obteniendo datos del usuario:', error);
          callback('No asignado');
        }
      });
    };

    this.loadPipelines = function() {
      console.log('Cargando pipelines...');
      
      $.ajax({
        url: '/api/v4/leads/pipelines',
        method: 'GET',
        dataType: 'json',
        success: function(data) {
          console.log('Pipelines obtenidos:', data);
          pipelines = data._embedded.pipelines;
          self.populatePipelineSelect();
        },
        error: function(error) {
          console.error('Error obteniendo pipelines:', error);
          self.showSnackbar('Error obteniendo pipelines: ' + error.statusText, 'error');
        }
      });
    };

    this.populatePipelineSelect = function() {
      var select = $('#km-pipeline-select');
      select.empty().append('<option value="">Seleccionar pipeline...</option>');
      
      pipelines.forEach(function(pipeline) {
        select.append(`<option value="${pipeline.id}">${pipeline.name}</option>`);
      });
    };

    this.loadPipelineStatuses = function(pipelineId) {
      console.log('Cargando status del pipeline:', pipelineId);
      
      $('#km-status-select').prop('disabled', true).empty().append('<option value="">Cargando...</option>');
      
      $.ajax({
        url: `/api/v4/leads/pipelines/${pipelineId}/statuses`,
        method: 'GET',
        dataType: 'json',
        success: function(data) {
          console.log('Status del pipeline obtenidos:', data);
          self.populateStatusSelect(data._embedded.statuses);
        },
        error: function(error) {
          console.error('Error obteniendo status del pipeline:', error);
          self.showSnackbar('Error obteniendo status: ' + error.statusText, 'error');
          $('#km-status-select').empty().append('<option value="">Error cargando status</option>');
        }
      });
    };

    this.populateStatusSelect = function(statuses) {
      var select = $('#km-status-select');
      select.empty().append('<option value="">Seleccionar status...</option>');
      
      statuses.forEach(function(status) {
        select.append(`<option value="${status.id}">${status.name}</option>`);
      });
      
      select.prop('disabled', false);
      self.updateDuplicateButton();
    };

    this.updateDuplicateButton = function() {
      var btn = $('#km-duplicate-btn');
      if (selectedPipeline && selectedStatus && currentLeadData) {
        btn.prop('disabled', false);
      } else {
        btn.prop('disabled', true);
      }
    };

    this.duplicateLead = function() {
      if (!currentLeadData) {
        self.showSnackbar('No hay datos del lead para duplicar', 'error');
        return;
      }

      console.log('Duplicando lead...');
      $('#km-duplicate-btn').prop('disabled', true).text('Duplicando...');

      // Preparar datos para el nuevo lead
      var newLeadData = [{
        name: currentLeadData.name + ' (Copia)',
        price: currentLeadData.price || 0,
        status_id: parseInt(selectedStatus),
        pipeline_id: parseInt(selectedPipeline),
        responsible_user_id: currentLeadData.responsible_user_id,
        custom_fields_values: currentLeadData.custom_fields_values || [],
        _embedded: {}
      }];

      // Agregar contactos si existen
      if (currentLeadData._embedded && currentLeadData._embedded.contacts) {
        newLeadData[0]._embedded.contacts = currentLeadData._embedded.contacts.map(function(contact) {
          return {
            id: contact.id,
            is_main: contact.is_main || false
          };
        });
      }

      // Agregar empresas si existen
      if (currentLeadData._embedded && currentLeadData._embedded.companies) {
        newLeadData[0]._embedded.companies = currentLeadData._embedded.companies.map(function(company) {
          return {
            id: company.id
          };
        });
      }

      console.log('Datos para el nuevo lead:', newLeadData);

      $.ajax({
        url: '/api/v4/leads',
        method: 'POST',
        dataType: 'json',
        contentType: 'application/json',
        data: JSON.stringify(newLeadData),
        success: function(response) {
          console.log('Lead duplicado exitosamente:', response);
          var newLeadId = response._embedded.leads[0].id;
          self.showSnackbar('Lead duplicado exitosamente. ID: ' + newLeadId, 'success');
          
          // Reiniciar el formulario
          $('#km-pipeline-select').val('');
          $('#km-status-select').empty().append('<option value="">Primero selecciona un pipeline</option>').prop('disabled', true);
          selectedPipeline = null;
          selectedStatus = null;
          $('#km-duplicate-btn').prop('disabled', true).text('Duplicar Lead');
        },
        error: function(error) {
          console.error('Error duplicando lead:', error);
          var errorMessage = 'Error duplicando lead';
          if (error.responseJSON && error.responseJSON.detail) {
            errorMessage += ': ' + error.responseJSON.detail;
          } else {
            errorMessage += ': ' + error.statusText;
          }
          self.showSnackbar(errorMessage, 'error');
          $('#km-duplicate-btn').prop('disabled', false).text('Duplicar Lead');
        }
      });
    };

    this.showSnackbar = function(message, type = 'info') {
      var snackbar = $('#km-snackbar');
      snackbar.removeClass('error success').addClass(type);
      snackbar.text(message);
      snackbar.addClass('show');
      setTimeout(function() {
        snackbar.removeClass('show');
      }, 3000);
    };

    // Event listeners adicionales
    $(document).on('change', '#km-pipeline-select', function() {
      selectedPipeline = $(this).val();
      selectedStatus = null;
      if (selectedPipeline) {
        self.loadPipelineStatuses(selectedPipeline);
      } else {
        $('#km-status-select').empty().append('<option value="">Primero selecciona un pipeline</option>').prop('disabled', true);
        self.updateDuplicateButton();
      }
    });

    $(document).on('change', '#km-status-select', function() {
      selectedStatus = $(this).val();
      self.updateDuplicateButton();
    });

    return this;
  };
  return CustomWidget;
});