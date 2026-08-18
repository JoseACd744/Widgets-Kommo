define(['jquery'], function ($) {
  var CustomWidget = function () {
    var self = this;

    // ─── Configuración ──────────────────────────────────────────────────────
    // Ambos campos deben tener una opción (enum) cuyo texto coincida EXACTAMENTE
    // con el nombre de cada usuario.
    var FIELD_LEAD_SELECT    = '1984767'; // campo select del LEAD
    var FIELD_CONTACT_SELECT = '1981921'; // campo select del CONTACTO
    var EXCLUDE_NAME_SUBSTRING = 'holos'; // se excluye cualquier usuario cuyo nombre contenga esto (sin distinguir mayúsculas)

    this.callbacks = {
      settings:     function () { return true; },
      init:         function () {
        console.log('[KM] init v1.2.0');
        self.loadCSS();
        return true;
      },
      bind_actions: function () {
        $(document).off('click.kmUserSave').on('click.kmUserSave', '#km-user-save-btn', function () {
          self.handleSave();
        });
        return true;
      },
      render:       function () {
        self.renderPanel();
        return true;
      },
      onSave:       function () { return true; },
      destroy:      function () {}
    };

    this.usersById = {};

    // ─── Cargar style.css con versión (evita choques y problemas de caché) ────

    this.loadCSS = function () {
      var settings = self.get_settings();
      var href = settings.path + '/style.css?v=' + settings.version;
      if ($('link[href="' + href + '"]').length < 1) {
        $('head').append('<link href="' + href + '" type="text/css" rel="stylesheet">');
      }
    };

    // ─── Render en el panel izquierdo del lead ────────────────────────────────

    this.renderPanel = function () {
      console.log('[KM] renderPanel', { is_card: APP.data.is_card, entity: APP.data.current_entity });

      if (!APP.data.is_card || APP.data.current_entity !== 'leads') {
        console.log('[KM] renderPanel: no es tarjeta de lead, no se renderiza.');
        return;
      }
      if ($('#km-user-widget').length) {
        console.log('[KM] renderPanel: ya estaba renderizado, se omite.');
        return;
      }

      self.render_template({
        caption: {
          class_name: 'js-km-caption',
          html: 'Responsable'
        },
        body:
          '<div id="km-user-widget" class="km-user-widget-root" style="background:#ffffff;border-radius:6px;padding:10px;box-sizing:border-box;">' +
            '<div id="km-user-loading" class="km-user-widget__loading" style="color:#8f97a3;font-size:13px;">Cargando usuarios...</div>' +
            '<div id="km-user-content" class="km-user-widget__content" style="display:none;">' +
              '<label for="km-user-select" class="km-user-widget__label" style="display:block;color:#2e3f52;font-weight:600;font-size:12px;margin-bottom:6px;">Responsable</label>' +
              '<select id="km-user-select" class="km-user-widget__select" style="width:100%;padding:6px 8px;font-size:13px;color:#2e3f52;background:#ffffff;border:1px solid #d6dae0;border-radius:4px;box-sizing:border-box;"></select>' +
              '<button id="km-user-save-btn" type="button" class="km-user-widget__save-btn" style="margin-top:8px;padding:6px 16px;font-size:13px;font-weight:500;color:#ffffff;background-color:#29b0d9;border:none;border-radius:4px;cursor:pointer;">Guardar</button>' +
            '</div>' +
          '</div>' +
          '<div id="km-user-snackbar" class="km-user-widget-snackbar"></div>',
        render: ''
      });

      console.log('[KM] render_template llamado. ¿DOM insertado?', $('#km-user-widget').length > 0);

      self.setup();
    };

    // ─── Mostrar error dentro del propio widget (no dejar el spinner colgado) ──

    this.showLoadError = function (msg) {
      console.error('[KM]', msg);
      $('#km-user-loading').text(msg).css('color', '#e25151');
    };

    // ─── Punto de entrada ──────────────────────────────────────────────────────

    this.setup = function () {
      console.log('[KM] setup: buscando campo lead', FIELD_LEAD_SELECT);
      var leadField = self.findField(FIELD_LEAD_SELECT);
      console.log('[KM] setup: leadField encontrado ->', leadField);

      if (!leadField) {
        self.showLoadError('No se encontró el campo select del lead (ID ' + FIELD_LEAD_SELECT + '). Revisa FIELD_LEAD_SELECT.');
        return;
      }

      if (leadField.type !== 'select') {
        self.showLoadError('El campo ' + FIELD_LEAD_SELECT + ' no es de tipo select (es "' + leadField.type + '").');
        return;
      }

      console.log('[KM] setup: pidiendo campo de contacto', FIELD_CONTACT_SELECT);
      self.fetchContactFieldDef(FIELD_CONTACT_SELECT, function (contactField) {
        console.log('[KM] setup: contactField recibido ->', contactField);

        if (!contactField) {
          self.showLoadError('No se pudo obtener el campo select del contacto (ID ' + FIELD_CONTACT_SELECT + '). Revisa la consola para el error de red.');
          return;
        }

        if (contactField.type !== 'select') {
          self.showLoadError('El campo de contacto ' + FIELD_CONTACT_SELECT + ' no es de tipo select (es "' + contactField.type + '").');
          return;
        }

        self.leadSelectField = leadField;
        self.contactSelectField = contactField;

        console.log('[KM] setup: pidiendo lista de usuarios...');
        self.fetchAllUsers(function (users) {
          console.log('[KM] setup: usuarios recibidos (tras filtrar "holos") ->', users.length, users);
          var currentResponsibleId = self.getCurrentResponsibleId();
          console.log('[KM] setup: responsable actual del lead ->', currentResponsibleId);
          self.renderUserSelect(users, currentResponsibleId);
        });
      });
    };

    // ─── Buscar campo de LEAD por nombre o ID (definiciones locales) ──────────
    // El objeto interno de Kommo usa claves en mayúsculas (TYPE_CODE, ENUMS como
    // mapa {id: enum}), así que se normaliza a la misma forma que fetchContactFieldDef.

    this.findField = function (identifier) {
      var cf = APP.constant('account').cf || {};
      var values = Object.values(cf);
      for (var i = 0; i < values.length; i++) {
        var f = values[i];
        if (f.NAME === identifier || String(f.ID) === String(identifier)) {
          return {
            ID: f.ID,
            NAME: f.NAME,
            type: (f.TYPE_CODE || '').toLowerCase(),
            enums: Object.values(f.ENUMS || {}).map(function (e) {
              return { ID: e.ID, VALUE: e.VALUE };
            })
          };
        }
      }
      return null;
    };

    // ─── Obtener la definición de un campo de CONTACTO vía API ────────────────

    this.fetchContactFieldDef = function (id, onDone) {
      var url = '/api/v4/contacts/custom_fields/' + id;
      console.log('[KM] fetchContactFieldDef: GET', url);
      $.ajax({
        url: url,
        method: 'GET', dataType: 'json',
        success: function (field) {
          console.log('[KM] fetchContactFieldDef: respuesta OK ->', field);
          onDone({
            ID: field.id,
            NAME: field.name,
            type: field.type,
            enums: (field.enums || []).map(function (e) {
              return { ID: e.id, VALUE: e.value };
            })
          });
        },
        error: function (xhr) {
          console.error('[KM] fetchContactFieldDef: error', {
            status: xhr.status,
            statusText: xhr.statusText,
            responseText: xhr.responseText
          });
          onDone(null);
        }
      });
    };

    // ─── Obtener todos los usuarios de la cuenta (con paginación) ─────────────

    this.fetchAllUsers = function (onDone) {
      var collected = [];

      function fetchPage(page) {
        var url = '/api/v4/users?limit=250&page=' + page;
        console.log('[KM] fetchAllUsers: GET', url);
        $.ajax({
          url: url,
          method: 'GET', dataType: 'json',
          success: function (data) {
            var users = (data._embedded && data._embedded.users) || [];
            console.log('[KM] fetchAllUsers: página', page, '->', users.length, 'usuarios');
            collected = collected.concat(users);

            var hasNext = data._links && data._links.next;
            if (hasNext && users.length > 0) {
              fetchPage(page + 1);
            } else {
              var filtered = collected.filter(function (u) {
                return (u.name || '').toLowerCase().indexOf(EXCLUDE_NAME_SUBSTRING) === -1;
              });
              console.log('[KM] fetchAllUsers: total', collected.length, '-> filtrados', filtered.length);
              filtered.forEach(function (u) { self.usersById[u.id] = u; });
              onDone(filtered);
            }
          },
          error: function (xhr) {
            console.error('[KM] fetchAllUsers: error', {
              status: xhr.status,
              statusText: xhr.statusText,
              responseText: xhr.responseText
            });
            self.showLoadError('Error al cargar usuarios (HTTP ' + xhr.status + '). Revisa la consola.');
            onDone(collected);
          }
        });
      }

      fetchPage(1);
    };

    // ─── Usuario responsable actual del lead ───────────────────────────────────

    this.getCurrentResponsibleId = function () {
      var card = APP.data.current_card;
      if (card && card.responsible_user_id) return card.responsible_user_id;
      try {
        return card.fields_hider.model.attributes.responsible_user_id || null;
      } catch (e) {
        return null;
      }
    };

    // ─── Render del dropdown de usuarios ────────────────────────────────────────

    this.renderUserSelect = function (users, currentResponsibleId) {
      console.log('[KM] renderUserSelect:', users.length, 'usuarios. #km-user-select existe?', $('#km-user-select').length > 0);
      $('#km-user-loading').hide();

      if (!users.length) {
        $('#km-user-loading').show().text('No hay usuarios disponibles.');
        return;
      }

      var html = '<option value="">— Selecciona un usuario —</option>';
      users.forEach(function (user) {
        var isActive = String(user.id) === String(currentResponsibleId);
        var name = $('<s>').text(user.name).html();
        html += '<option value="' + user.id + '"' + (isActive ? ' selected' : '') + '>' + name + '</option>';
      });

      $('#km-user-select').html(html);
      $('#km-user-content').show();
    };

    // ─── Guardar: campo select del lead + campo select del contacto + responsabless ──

    this.handleSave = function () {
      var userId = $('#km-user-select').val();

      if (!userId) {
        self.showSnackbar('Selecciona un usuario antes de guardar.');
        return;
      }

      var user = self.usersById[userId];
      if (!user) {
        console.error('[KM] handleSave: usuario no encontrado en caché, id:', userId);
        self.showSnackbar('Error interno: usuario no encontrado. Recarga la tarjeta.');
        return;
      }

      var leadEnum = self.findMatchingEnum(self.leadSelectField, user.name);
      var contactEnum = self.findMatchingEnum(self.contactSelectField, user.name);

      if (!leadEnum) {
        console.error('[KM] No existe una opción con el nombre "' + user.name + '" en el campo select del lead.');
        self.showSnackbar('No se encontró una opción para "' + user.name + '" en el campo del lead.');
        return;
      }

      if (!contactEnum) {
        console.error('[KM] No existe una opción con el nombre "' + user.name + '" en el campo select del contacto.');
        self.showSnackbar('No se encontró una opción para "' + user.name + '" en el campo del contacto.');
        return;
      }

      var leadId = APP.data.current_card.id;

      $.ajax({
        url: '/api/v4/leads/' + leadId,
        method: 'PATCH',
        contentType: 'application/json',
        data: JSON.stringify({
          responsible_user_id: user.id,
          custom_fields_values: [
            { field_id: self.leadSelectField.ID, values: [{ enum_id: Number(leadEnum.ID) }] }
          ]
        }),
        success: function () {
          self.updateContactResponsible(leadId, user, contactEnum);
        },
        error: function (xhr) {
          console.error('[KM] Error al actualizar el lead:', xhr.responseText);
          self.showSnackbar('Error al guardar en el lead. Revisa la consola.');
        }
      });
    };

    this.findMatchingEnum = function (field, text) {
      var enums = (field && field.enums) || [];
      for (var i = 0; i < enums.length; i++) {
        if (enums[i].VALUE === text) return enums[i];
      }
      return null;
    };

    this.updateContactResponsible = function (leadId, user, contactEnum) {
      $.ajax({
        url: '/api/v4/leads/' + leadId + '?with=contacts',
        method: 'GET', dataType: 'json',
        success: function (lead) {
          var contacts = (lead._embedded && lead._embedded.contacts) || [];
          if (!contacts.length) {
            console.warn('[KM] El lead no tiene contacto asociado; solo se actualizó el lead.');
            self.showSnackbar('Guardado (el lead no tiene contacto asociado).');
            return;
          }

          var contactId = contacts[0].id;

          $.ajax({
            url: '/api/v4/contacts/' + contactId,
            method: 'PATCH',
            contentType: 'application/json',
            data: JSON.stringify({
              responsible_user_id: user.id,
              custom_fields_values: [
                { field_id: self.contactSelectField.ID, values: [{ enum_id: Number(contactEnum.ID) }] }
              ]
            }),
            success: function () {
              self.showSnackbar('Guardado correctamente.');
            },
            error: function (xhr) {
              console.error('[KM] Error al actualizar el contacto:', xhr.responseText);
              self.showSnackbar('Lead guardado, pero falló al actualizar el contacto.');
            }
          });
        },
        error: function (xhr) {
          console.error('[KM] Error al obtener el contacto del lead:', xhr.responseText);
          self.showSnackbar('Lead guardado, pero no se pudo obtener su contacto.');
        }
      });
    };

    // ─── Snackbar ──────────────────────────────────────────────────────────────

    this.showSnackbar = function (msg) {
      var $bar = $('#km-user-snackbar');
      $bar.text(msg);
      $bar.addClass('km-user-widget-snackbar--show');
      setTimeout(function () { $bar.removeClass('km-user-widget-snackbar--show'); }, 3000);
    };

    return this;
  };
  return CustomWidget;
});
