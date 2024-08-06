define(['jquery'], function ($) {
  var CustomWidget = function () {
    var self = this;
    var pipelines = {};
    var contactInfo = {};
    var companyInfo = {};
    var originalLeadData = {};

    this.callbacks = {
      settings: function () {
        return true;
      },
      init: function () {
        self.loadCSS();
        return true;
      },
      bind_actions: function () {
        $(document).off('click', '#clone-btn').on('click', '#clone-btn', function () {
          self.cloneLead();
        });
        return true;
      },
      render: function () {
        self.render_template({
          caption: {
            class_name: 'js-km-caption',
            html: 'Clonar y Editar Lead'
          },
          body: '<div class="km-form">\
                   <div>\
                     <label for="lead-name">Nombre:</label>\
                     <input type="text" id="lead-name">\
                   </div>\
                   <div>\
                     <label for="lead-pipeline">Embudo:</label>\
                     <select id="lead-pipeline">\
                       <option value="" selected disabled>Seleccionar embudo</option>\
                     </select>\
                   </div>\
                   <div>\
                     <label for="lead-stage">Etapa:</label>\
                     <select id="lead-stage">\
                       <option value="" selected disabled>Seleccionar etapa</option>\
                     </select>\
                   </div>\
                   <div class="button-container">\
                     <button id="clone-btn">Clonar y Guardar</button>\
                   </div>\
                   <div id="snackbar"></div>',
          render: ''
        });
        self.fetchPipelines();
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

    this.loadCSS = function () {
      var settings = self.get_settings();
      if ($('link[href="' + settings.path + '/style.css?v=' + settings.version + '"').length < 1) {
        $('head').append('<link href="' + settings.path + '/style.css?v=' + settings.version + '" type="text/css" rel="stylesheet">');
      }
      $('head').append('<style>\
        #snackbar {\
          visibility: hidden;\
          min-width: 250px;\
          margin-left: -125px;\
          background-color: #333;\
          color: #fff;\
          text-align: center;\
          border-radius: 2px;\
          padding: 16px;\
          position: fixed;\
          z-index: 1;\
          left: 50%;\
          bottom: 30px;\
          font-size: 17px;\
        }\
        #snackbar.show {\
          visibility: visible;\
          -webkit-animation: fadein 0.5s, fadeout 0.5s 2.5s;\
          animation: fadein 0.5s, fadeout 0.5s 2.5s;\
        }\
        @-webkit-keyframes fadein {\
          from {bottom: 0; opacity: 0;}\
          to {bottom: 30px; opacity: 1;}\
        }\
        @keyframes fadein {\
          from {bottom: 0; opacity: 0;}\
          to {bottom: 30px; opacity: 1;}\
        }\
        @-webkit-keyframes fadeout {\
          from {bottom: 30px; opacity: 1;}\
          to {bottom: 0; opacity: 0;}\
        }\
        @keyframes fadeout {\
          from {bottom: 30px; opacity: 1;}\
          to {bottom: 0; opacity: 0;}\
        }\
      </style>');
    };

    this.fetchPipelines = function () {
      $.ajax({
        url: '/api/v4/leads/pipelines',
        method: 'GET',
        dataType: 'json',
        success: function(data) {
          console.log('Pipelines data:', data);
          data._embedded.pipelines.forEach(function(pipeline) {
            pipelines[pipeline.id] = pipeline.name;
            $('#lead-pipeline').append(new Option(pipeline.name, pipeline.id));
          });
          self.fetchLeadData();
        },
        error: function(error) {
          console.error('Error fetching pipelines:', error);
          self.showSnackbar('Error fetching pipelines: ' + error.statusText);
        }
      });
    };

    this.fetchStages = function (pipelineId) {
      $.ajax({
        url: '/api/v4/leads/pipelines/' + pipelineId + '/statuses',
        method: 'GET',
        dataType: 'json',
        success: function(data) {
          console.log('Stages data:', data);
          $('#lead-stage').empty();
          data._embedded.statuses.forEach(function(stage) {
            $('#lead-stage').append(new Option(stage.name, stage.id));
          });
        },
        error: function(error) {
          console.error('Error fetching stages:', error);
          self.showSnackbar('Error fetching stages: ' + error.statusText);
        }
      });
    };

    this.fetchLeadData = function () {
      var leadId = APP.data.current_card.id;

      $.ajax({
        url: `/api/v4/leads/${leadId}?with=contacts`,
        method: 'GET',
        dataType: 'json',
        success: function(data) {
          console.log('Lead data with contacts:', data);
          companyInfo = data._embedded.companies ? data._embedded.companies[0] : {};
          contactInfo = data._embedded.contacts ? data._embedded.contacts[0] : {};
          originalLeadData = data;
          self.populateForm(data);
        },
        error: function(error) {
          console.error('Error fetching lead data:', error);
          self.showSnackbar('Error fetching lead data: ' + error.statusText);
        }
      });
    };

    this.populateForm = function(leadData) {
      $('#lead-name').val(leadData.name || '');
      $('#lead-pipeline').val(leadData.pipeline_id || '');
      self.fetchStages(leadData.pipeline_id);
      setTimeout(function() {
        $('#lead-stage').val(leadData.status_id || '');
      }, 500);
    };

    this.cleanCustomFields = function(customFields) {
      return customFields.map(field => {
        const cleanedField = {
          field_id: field.field_id,
          values: field.values.map(value => {
            const cleanedValue = { ...value };
            delete cleanedValue.is_deleted;
            delete cleanedValue.is_computed;
            return cleanedValue;
          })
        };
        return cleanedField;
      }).filter(field => field.values.length > 0);
    };

    this.cloneLead = function() {
      var leadName = $('#lead-name').val();
      var leadPipeline = $('#lead-pipeline').val();
      var leadStage = $('#lead-stage').val();

      if (!leadName || !leadPipeline || !leadStage) {
        self.showSnackbar('Por favor, complete todos los campos.');
        return;
      }

      var clonedLeadData = {
        name: leadName,
        status_id: parseInt(leadStage),
        _embedded: {
          contacts: contactInfo ? [{
            id: contactInfo.id,
            name: `${contactInfo.first_name} ${contactInfo.last_name}`,
            first_name: contactInfo.first_name,
            last_name: contactInfo.last_name,
            custom_fields_values: contactInfo.custom_fields_values && contactInfo.custom_fields_values.length > 0 ? self.cleanCustomFields(contactInfo.custom_fields_values) : []
          }] : [],
          companies: companyInfo ? [{
            id: companyInfo.id,
            name: companyInfo.name
          }] : [],
          tags: originalLeadData._embedded.tags || []
        },
        custom_fields_values: originalLeadData.custom_fields_values && originalLeadData.custom_fields_values.length > 0 ? self.cleanCustomFields(originalLeadData.custom_fields_values) : []
      };

      if (clonedLeadData._embedded.contacts.length > 0 && clonedLeadData._embedded.contacts[0].custom_fields_values.length === 0) {
        delete clonedLeadData._embedded.contacts[0].custom_fields_values;
      }

      console.log('Cloning lead with data:', JSON.stringify(clonedLeadData, null, 2));

      $.ajax({
        url: '/api/v4/leads/complex',
        method: 'POST',
        contentType: 'application/json',
        data: JSON.stringify([clonedLeadData]),
        success: function(response) {
          console.log('Lead cloned successfully:', response);
          self.showSnackbar('El lead se ha clonado y guardado con éxito.');
        },
        error: function(error) {
          console.error('Error cloning lead:', error);
          console.log('Error response:', error.responseText);
          self.showSnackbar('Error al clonar el lead: ' + error.statusText);
        }
      });
    };

    this.showSnackbar = function(message) {
      var snackbar = $('#snackbar');
      snackbar.text(message);
      snackbar.addClass('show');
      setTimeout(function() {
        snackbar.removeClass('show');
      }, 3000);
    };

    return this;
  };
  return CustomWidget;
});
