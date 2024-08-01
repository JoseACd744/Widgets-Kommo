define(['jquery'], function ($) {
  var CustomWidget = function () {
    var self = this;
    var pipelines = {};

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
                     <label for="lead-stage">Etapa:</label>\
                     <select id="lead-stage">\
                       <option value="" selected disabled>Seleccionar etapa</option>\
                     </select>\
                   </div>\
                   <div>\
                     <label for="meses">Meses:</label>\
                     <input type="number" id="meses" value="0" min="0">\
                   </div>\
                   <div>\
                     <label for="usuarios">Usuarios:</label>\
                     <input type="number" id="usuarios" value="0" min="0">\
                   </div>\
                   <div>\
                     <label for="plan-kommo">Plan Kommo:</label>\
                     <select id="plan-kommo">\
                       <option value="" selected disabled>Seleccionar plan</option>\
                       <option value="Básico">Básico</option>\
                       <option value="Avanzado">Avanzado</option>\
                       <option value="Empresarial">Empresarial</option>\
                     </select>\
                   </div>\
                   <div>\
                     <label for="google-meet">Google Meet:</label>\
                     <input type="url" id="google-meet">\
                   </div>\
                   <div>\
                     <label for="fecha-calendly">Fecha Calendly:</label>\
                     <input type="datetime-local" id="fecha-calendly">\
                   </div>\
                   <div>\
                     <label for="compromiso-asistencia">Compromiso Asistencia:</label>\
                     <textarea id="compromiso-asistencia"></textarea>\
                   </div>\
                   <div>\
                     <label for="cantidad-agentes">Cantidad Agentes:</label>\
                     <textarea id="cantidad-agentes"></textarea>\
                   </div>\
                   <div>\
                     <label for="urgencia">Urgencia:</label>\
                     <textarea id="urgencia"></textarea>\
                   </div>\
                   <div>\
                     <label for="valor-onboarding">Valor Onboarding:</label>\
                     <input type="number" id="valor-onboarding" value="0" min="0">\
                   </div>\
                   <div>\
                     <label for="valor-licencias">Valor Licencias Kommo:</label>\
                     <input type="number" id="valor-licencias" value="0" min="0">\
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

    this.loadCSS = function() {
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
            $('#lead-stage').append(new Option(pipeline.name, pipeline.id));
          });
          self.fetchLeadData();
        },
        error: function(error) {
          console.error('Error fetching pipelines:', error);
          self.showSnackbar('Error fetching pipelines: ' + error.statusText);
        }
      });
    };

    this.fetchLeadData = function () {
      var leadId = APP.data.current_card.id;

      $.ajax({
        url: '/api/v4/leads/' + leadId,
        method: 'GET',
        dataType: 'json',
        success: function(data) {
          console.log('Lead data:', data);
          self.populateForm(data);
        },
        error: function(error) {
          console.error('Error fetching lead data:', error);
          self.showSnackbar('Error fetching lead data: ' + error.statusText);
        }
      });
    };

    this.populateForm = function(leadData) {
      var customFields = leadData.custom_fields_values;
      var attributes = {};
      customFields.forEach(function(field) {
        attributes[field.field_id] = field.values[0].value;
      });

      $('#lead-name').val(leadData.name || '');
      $('#lead-stage').val(leadData.pipeline_id || '');
      $('#meses').val(attributes['794456'] || '0');
      $('#usuarios').val(attributes['794454'] || '0');
      $('#plan-kommo').val(attributes['794639'] || '');
      $('#google-meet').val(attributes['792794'] || '');
      $('#fecha-calendly').val(new Date(attributes['792418'] * 1000).toISOString().slice(0, -1) || '');
      $('#compromiso-asistencia').val(attributes['794683'] || '');
      $('#cantidad-agentes').val(attributes['794685'] || '');
      $('#urgencia').val(attributes['794687'] || '');
      $('#valor-onboarding').val(attributes['794641'] || '0');
      $('#valor-licencias').val(attributes['794643'] || '0');

      self.highlightCurrentPipeline(leadData.pipeline_id);
    };

    this.highlightCurrentPipeline = function(pipelineId) {
      if (pipelines[pipelineId]) {
        $('#lead-stage').val(pipelineId);
      }
    };

    this.cloneLead = function() {
      var leadName = $('#lead-name').val();
      var leadStage = $('#lead-stage').val();
      var meses = $('#meses').val().toString();
      var usuarios = $('#usuarios').val().toString();
      var planKommo = $('#plan-kommo').val();
      var googleMeet = $('#google-meet').val();
      var fechaCalendly = new Date($('#fecha-calendly').val()).getTime() / 1000;
      var compromisoAsistencia = $('#compromiso-asistencia').val();
      var cantidadAgentes = $('#cantidad-agentes').val();
      var urgencia = $('#urgencia').val();
      var valorOnboarding = $('#valor-onboarding').val().toString();
      var valorLicencias = $('#valor-licencias').val().toString();

      if (!leadName || !leadStage || !meses || !usuarios || !planKommo) {
        self.showSnackbar('Por favor, complete todos los campos.');
        return;
      }

      var customFields = [
        { field_id: 794456, values: [{ value: meses }] },
        { field_id: 794454, values: [{ value: usuarios }] },
        { field_id: 794639, values: [{ value: planKommo }] },
        { field_id: 792794, values: [{ value: googleMeet }] },
        { field_id: 792418, values: [{ value: fechaCalendly }] },
        { field_id: 794683, values: [{ value: compromisoAsistencia }] },
        { field_id: 794685, values: [{ value: cantidadAgentes }] },
        { field_id: 794687, values: [{ value: urgencia }] },
        { field_id: 794641, values: [{ value: valorOnboarding }] },
        { field_id: 794643, values: [{ value: valorLicencias }] }
      ];

      var newLeadData = {
        name: leadName,
        status_id: leadStage,
        custom_fields_values: customFields
      };

      $.ajax({
        url: '/api/v4/leads',
        method: 'POST',
        contentType: 'application/json',
        data: JSON.stringify(newLeadData),
        success: function(response) {
          console.log('Lead cloned successfully:', response);
          self.showSnackbar('El lead se ha clonado y guardado con éxito.');
        },
        error: function(error) {
          console.error('Error cloning lead:', error);
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
