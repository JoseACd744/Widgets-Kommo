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
        console.log('[KM] init v1.1.0');
        self.setup();
        return true;
      },
      bind_actions: function () {
        $(document).off('click.kmUserRow').on('click.kmUserRow', '.km-user-row', function () {
          var userId = $(this).data('user-id');
          var user = self.usersById[userId];
          if (user) self.handleSelectUser(user);
        });
        return true;
      },
      render:       function () {
        // lcard-1 dispara render — no usamos el panel derecho, la UI se inyecta en un tab.
        return true;
      },
      onSave:       function () { return true; },
      destroy:      function () {}
    };

    this.usersById = {};

    // ─── Punto de entrada ──────────────────────────────────────────────────────

    this.setup = function () {
      if (!APP.data.is_card || APP.data.current_entity !== 'leads') return;

      var leadField = self.findField(FIELD_LEAD_SELECT);

      if (!leadField) {
        console.warn('[KM] No se encontró el campo select del lead (FIELD_LEAD_SELECT):', FIELD_LEAD_SELECT);
        return;
      }

      if (leadField.type !== 'select') {
        console.warn('[KM] FIELD_LEAD_SELECT debe ser de tipo select.', leadField);
        return;
      }

      self.fetchContactFieldDef(FIELD_CONTACT_SELECT, function (contactField) {
        if (!contactField) {
          console.warn('[KM] No se encontró el campo select del contacto (FIELD_CONTACT_SELECT):', FIELD_CONTACT_SELECT);
          return;
        }

        if (contactField.type !== 'select') {
          console.warn('[KM] FIELD_CONTACT_SELECT debe ser de tipo select.', contactField);
          return;
        }

        self.leadSelectField = leadField;
        self.contactSelectField = contactField;
        self.findTabAndInject(leadField);
      });
    };

    // ─── Buscar campo de LEAD por nombre o ID (definiciones locales) ──────────

    this.findField = function (identifier) {
      var cf = APP.constant('account').cf || {};
      var values = Object.values(cf);
      for (var i = 0; i < values.length; i++) {
        var f = values[i];
        if (f.NAME === identifier || String(f.ID) === String(identifier)) return f;
      }
      return null;
    };

    // ─── Obtener la definición de un campo de CONTACTO vía API ────────────────

    this.fetchContactFieldDef = function (id, onDone) {
      $.ajax({
        url: '/api/v4/contacts/custom_fields/' + id,
        method: 'GET', dataType: 'json',
        success: function (field) {
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
          console.error('[KM] Error al obtener el campo de contacto:', xhr.responseText);
          onDone(null);
        }
      });
    };

    // ─── Encontrar el tab del campo e inyectar el HTML ─────────────────────────

    this.findTabAndInject = function (selectField) {
      var card = APP.data.current_card;
      if (!card || !card.tabs || !card.tabs._tabs) return;

      var tab = null;
      var tabs = card.tabs._tabs;
      for (var i = 0; i < tabs.length; i++) {
        if (tabs[i].fields && tabs[i].fields.indexOf(selectField.ID) !== -1) {
          tab = tabs[i];
          break;
        }
      }

      if (!tab) {
        console.warn('[KM] No se encontró el tab para el campo select ID:', selectField.ID);
        return;
      }

      var tabId = tab.id;
      var $container = $('.linked-forms__group-wrapper[data-id="' + tabId + '"]');

      if ($container.length) {
        self.injectContainer($container);
      } else {
        // El contenido del tab puede cargar de forma diferida
        var observer = new MutationObserver(function (_, obs) {
          var $c = $('.linked-forms__group-wrapper[data-id="' + tabId + '"]');
          if ($c.length) {
            obs.disconnect();
            self.injectContainer($c);
          }
        });
        observer.observe(document.body, { childList: true, subtree: true });
        setTimeout(function () { observer.disconnect(); }, 15000);
      }
    };

    // ─── Preparar el contenedor y cargar usuarios ──────────────────────────────

    this.injectContainer = function ($container) {
      if ($container.find('#km-user-widget').length) return;

      $container.html(
        '<div id="km-user-widget" class="km-user-widget">' +
          '<div id="km-user-loading" class="km-user-loading">Cargando usuarios...</div>' +
          '<div id="km-user-list" class="km-user-list"></div>' +
        '</div>'
      );

      $('body').append('<div id="km-user-snackbar" class="km-snackbar"></div>');

      self.fetchAllUsers(function (users) {
        var currentResponsibleId = self.getCurrentResponsibleId();
        self.renderUserList(users, currentResponsibleId);
      });
    };

    // ─── Obtener todos los usuarios de la cuenta (con paginación) ─────────────

    this.fetchAllUsers = function (onDone) {
      var collected = [];

      function fetchPage(page) {
        $.ajax({
          url: '/api/v4/users?limit=250&page=' + page,
          method: 'GET', dataType: 'json',
          success: function (data) {
            var users = (data._embedded && data._embedded.users) || [];
            collected = collected.concat(users);

            var hasNext = data._links && data._links.next;
            if (hasNext && users.length > 0) {
              fetchPage(page + 1);
            } else {
              var filtered = collected.filter(function (u) {
                return (u.name || '').toLowerCase().indexOf(EXCLUDE_NAME_SUBSTRING) === -1;
              });
              filtered.forEach(function (u) { self.usersById[u.id] = u; });
              onDone(filtered);
            }
          },
          error: function (xhr) {
            console.error('[KM] Error al cargar usuarios:', xhr.responseText);
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

    // ─── Render de la lista clicable ────────────────────────────────────────────

    this.renderUserList = function (users, currentResponsibleId) {
      $('#km-user-loading').remove();

      if (!users.length) {
        $('#km-user-list').html('<span class="km-user-empty">No hay usuarios disponibles.</span>');
        return;
      }

      var html = '';
      users.forEach(function (user) {
        var isActive = String(user.id) === String(currentResponsibleId);
        var name = $('<s>').text(user.name).html();
        html +=
          '<div class="km-user-row' + (isActive ? ' km-user-row--active' : '') + '" data-user-id="' + user.id + '">' +
            '<span class="km-user-row__name">' + name + '</span>' +
            (isActive ? '<span class="km-user-row__badge">Actual</span>' : '') +
          '</div>';
      });

      $('#km-user-list').html(html);
    };

    // ─── Al elegir un usuario: guardar en el campo select, lead y contacto ─────

    this.handleSelectUser = function (user) {
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
            self.markActiveRow(user.id);
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
              self.markActiveRow(user.id);
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

    this.markActiveRow = function (userId) {
      $('.km-user-row').removeClass('km-user-row--active').find('.km-user-row__badge').remove();
      var $row = $('.km-user-row[data-user-id="' + userId + '"]');
      $row.addClass('km-user-row--active');
      $row.append('<span class="km-user-row__badge">Actual</span>');
    };

    // ─── Snackbar ──────────────────────────────────────────────────────────────

    this.showSnackbar = function (msg) {
      var $bar = $('#km-user-snackbar');
      $bar.text(msg);
      $bar.addClass('show');
      setTimeout(function () { $bar.removeClass('show'); }, 3000);
    };

    return this;
  };
  return CustomWidget;
});
