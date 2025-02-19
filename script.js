define(['jquery'], function ($) {
  var CustomWidget = function () {
    var self = this;
    var contactLeadsPage = 1;
    var isLoadingLeads = false;
    var allLeadsLoaded = false;

    this.callbacks = {
      settings: function () {
        return true;
      },
      init: function () {
        self.loadCSS();
        return true;
      },
      bind_actions: function () {
        $('#leads-container').on('scroll', function() {
          if ($(this).scrollTop() + $(this).innerHeight() >= this.scrollHeight - 100 && !isLoadingLeads && !allLeadsLoaded) {
            self.fetchContactLeads();
          }
        });
        return true;
      },
      render: function () {
        self.render_template({
          caption: {
            class_name: 'js-km-caption',
            html: 'Contact Leads'
          },
          body: '<div id="leads-container" class="leads-container"></div>\
                 <div id="loading-indicator" class="loading-indicator" style="display: none;"></div>\
                 <div id="snackbar"></div>',
          render: ''
        });
        self.fetchContactLeads();
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
        .leads-container {\
          display: flex;\
          flex-direction: column;\
          gap: 10px;\
          height: 400px;\
          overflow-y: auto;\
        }\
        .lead-card {\
          background-color: #fff;\
          border: 1px solid #ddd;\
          border-radius: 4px;\
          padding: 10px;\
          width: 100%;\
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);\
          cursor: pointer;\
        }\
        .lead-card h3 {\
          margin: 0 0 10px;\
          font-size: 18px;\
        }\
        .lead-card p {\
          margin: 0;\
          font-size: 14px;\
          color: #666;\
        }\
        .loading-indicator {\
          border: 16px solid #f3f3f3;\
          border-radius: 50%;\
          border-top: 16px solid #3498db;\
          width: 120px;\
          height: 120px;\
          -webkit-animation: spin 2s linear infinite;\
          animation: spin 2s linear infinite;\
          margin: 20px auto;\
        }\
        @-webkit-keyframes spin {\
          0% { -webkit-transform: rotate(0deg); }\
          100% { -webkit-transform: rotate(360deg); }\
        }\
        @keyframes spin {\
          0% { transform: rotate(0deg); }\
          100% { transform: rotate(360deg); }\
        }\
      </style>');
    };

    this.fetchContactLeads = function() {
      var leadId = APP.data.current_card.id;
      console.log('Fetching lead data for lead ID:', leadId);

      $.ajax({
        url: '/api/v4/leads/' + leadId + '?with=contacts',
        method: 'GET',
        dataType: 'json',
        success: function(data) {
          console.log('Lead data fetched:', data);
          var contactId = data._embedded.contacts[0].id;
          console.log('Contact ID:', contactId);
          isLoadingLeads = true;
          $('#loading-indicator').show();
          $.ajax({
            url: `/api/v4/contacts/${contactId}?with=leads&page=${contactLeadsPage}&limit=20`,
            method: 'GET',
            dataType: 'json',
            success: function(response) {
              console.log('Contact leads response:', response);
              if (response && response._embedded && response._embedded.leads) {
                var leads = response._embedded.leads;
                if (leads.length === 0) {
                  allLeadsLoaded = true;
                  self.showSnackbar('No more leads to load.');
                } else {
                  leads.forEach(function(lead) {
                    $('#leads-container').append(
                      '<div class="lead-card" onclick="window.open(\'/leads/detail/' + lead.id + '\', \'_blank\')">' +
                        '<h3>' + (lead.name || 'Sin nombre') + '</h3>' +
                        '<p>ID: ' + lead.id + '</p>' +
                        '<p>Precio: ' + (lead.price || 'No disponible') + '</p>' +
                        '<p>Responsable: ' + (lead.responsible_user_id || 'No asignado') + '</p>' +
                      '</div>'
                    );
                  });
                  contactLeadsPage++;
                }
              } else {
                console.log('No leads found or response format is incorrect:', response);
                allLeadsLoaded = true;
                self.showSnackbar('No more leads to load.');
              }
              isLoadingLeads = false;
              $('#loading-indicator').hide();
            },
            error: function(error) {
              console.error('Error fetching contact leads:', error);
              self.showSnackbar('Error fetching contact leads: ' + error.statusText);
              isLoadingLeads = false;
              $('#loading-indicator').hide();
            }
          });
        },
        error: function(error) {
          console.error('Error fetching lead data:', error);
          self.showSnackbar('Error fetching lead data: ' + error.statusText);
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