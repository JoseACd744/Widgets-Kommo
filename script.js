define(['jquery'], function ($) {
  var CustomWidget = function () {
    var self = this;

    this.callbacks = {
      settings: function () {
        return true;
      },
      init: function () {
        self.loadCSS();
        return true;
      },
      bind_actions: function () {
        return true;
      },
      render: function () {
        self.render_template({
          caption: {
            class_name: 'js-km-caption',
            html: 'Calendario de Holos'
          },
          body: '<div class="calendly-container">\
                   <div class="calendly-inline-widget" data-url="https://calendly.com/holos-digital?background_color=f6f3f3&primary_color=2f2662" style="min-width:100%;height:100%;"></div>\
                 </div>',
          render: ''
        });
        self.loadCalendlyScript();
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
      var cssFilePath = settings.path + '/style.css?v=' + settings.version;
      if ($('link[href="' + cssFilePath + '"]').length < 1) {
        $('head').append('<link href="' + cssFilePath + '" type="text/css" rel="stylesheet">');
      }
    };

    this.loadCalendlyScript = function() {
      if (!$('script[src="https://assets.calendly.com/assets/external/widget.js"]').length) {
        $('head').append('<script type="text/javascript" src="https://assets.calendly.com/assets/external/widget.js" async></script>');
      }
    };

    return this;
  };
  return CustomWidget;
});
