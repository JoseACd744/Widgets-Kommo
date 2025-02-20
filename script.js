define(['jquery'], function ($) {
  var CustomWidget = function () {
    var self = this;
    var contactLeadsPage = 1;
    var isLoadingLeads = false;
    var allLeadsLoaded = false;
    var snackbarShown = false;

    this.callbacks = {
      settings: function () {
        return true;
      },
      init: function () {
        self.loadCSS();
        return true;
      },
      bind_actions: function () {
        $('#km-leads-container').on('scroll', function() {
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
          body: '<div id="km-leads-container" class="km-leads-container"></div>\
                 <div id="km-snackbar" class="km-snackbar"></div>',
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
        .km-snackbar {\
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
        .km-snackbar.show {\
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
        .km-leads-container {\
          display: flex;\
          flex-direction: column;\
          gap: 10px;\
          max-height: 400px;\
          overflow-y: auto;\
        }\
        .km-lead-card {\
          border: 1px solid #ddd;\
          border-radius: 4px;\
          padding: 10px;\
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);\
          cursor: pointer;\
        }\
        .km-lead-card h3 {\
          margin: 0 0 10px;\
          font-size: 18px;\
        }\
        .km-lead-card p {\
          margin: 0;\
          font-size: 14px;\
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
                  if (!snackbarShown) {
                    self.showSnackbar('No more leads to load.');
                    snackbarShown = true;
                  }
                } else {
                  leads.forEach(function(lead) {
                    self.fetchLeadDetails(lead.id);
                  });
                  contactLeadsPage++;
                }
              } else {
                console.log('No leads found or response format is incorrect:', response);
                allLeadsLoaded = true;
                if (!snackbarShown) {
                  self.showSnackbar('No more leads to load.');
                  snackbarShown = true;
                }
              }
              isLoadingLeads = false;
            },
            error: function(error) {
              console.error('Error fetching contact leads:', error);
              self.showSnackbar('Error fetching contact leads: ' + error.statusText);
              isLoadingLeads = false;
            }
          });
        },
        error: function(error) {
          console.error('Error fetching lead data:', error);
          self.showSnackbar('Error fetching lead data: ' + error.statusText);
        }
      });
    };

    this.fetchLeadDetails = function(leadId) {
      $.ajax({
        url: `/api/v4/leads/${leadId}`,
        method: 'GET',
        dataType: 'json',
        success: function(lead) {
          console.log('Lead details fetched:', lead);
          var responsibleUserId = lead.responsible_user_id;
          if (responsibleUserId) {
            self.fetchUserName(responsibleUserId, function(userName) {
              $('#km-leads-container').append(
                '<div class="km-lead-card" onclick="window.open(\'/leads/detail/' + lead.id + '\', \'_blank\')">' +
                  '<h3>' + (lead.name || 'Sin nombre') + '</h3>' +
                  '<p>ID: ' + lead.id + '</p>' +
                  '<p>Precio: $' + (lead.price !== undefined ? lead.price : 'No disponible') + '</p>' +
                  '<p>Responsable: ' + (userName || 'No asignado') + '</p>' +
                '</div>'
              );
              self.adjustContainerHeight();
            });
          } else {
            $('#km-leads-container').append(
              '<div class="km-lead-card" onclick="window.open(\'/leads/detail/' + lead.id + '\', \'_blank\')">' +
                '<h3>' + (lead.name || 'Sin nombre') + '</h3>' +
                '<p>ID: ' + lead.id + '</p>' +
                '<p>Precio: $' + (lead.price !== undefined ? lead.price : 'No disponible') + '</p>' +
                '<p>Responsable: No asignado</p>' +
              '</div>'
            );
            self.adjustContainerHeight();
          }
        },
        error: function(error) {
          console.error('Error fetching lead details:', error);
          self.showSnackbar('Error fetching lead details: ' + error.statusText);
        }
      });
    };

    this.fetchUserName = function(userId, callback) {
      $.ajax({
        url: `/api/v4/users/${userId}`,
        method: 'GET',
        dataType: 'json',
        success: function(user) {
          console.log('User details fetched:', user);
          callback(user.name);
        },
        error: function(error) {
          console.error('Error fetching user details:', error);
          callback('No asignado');
        }
      });
    };

    this.adjustContainerHeight = function() {
      var container = $('#km-leads-container');
      var totalHeight = 0;
      container.children().each(function() {
        totalHeight += $(this).outerHeight(true);
      });
      container.css('height', totalHeight + 'px');
    };

    this.showSnackbar = function(message) {
      var snackbar = $('#km-snackbar');
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