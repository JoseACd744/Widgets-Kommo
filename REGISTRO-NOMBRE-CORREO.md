# Flujo de registro (nombre/correo) — lecciones para el próximo widget

Este documento resume cómo quedó el flujo de registro en **`feature/other-leads-marketplace`**
(ya aceptado por Kommo Marketplace) y qué hay que revisar/ajustar al retomar
**`feature/phone-data-widget`**, que ya tiene una primera versión del mismo flujo pero con
algunas diferencias de formato.

## 1. El registro NO puede vivir en la tarjeta del lead

La primera versión de `other-leads-marketplace` tenía un formulario completo dentro de la
pestaña inyectada: inputs de nombre/correo, botones "Editar"/"Guardar"/"Cancelar", una vista
de solo lectura, y un GET (`checkSubdomain`) al cargar el tab para pre-rellenar el formulario
con `registeredData`. Todo esto se eliminó (commit `559b555`).

**Fix aplicado:** el registro vive **exclusivamente** en el panel de configuración de Kommo
(`manifest.json` → `settings`), disparado por el callback `onSave`. La pestaña/tarjeta del
widget solo muestra su propio contenido (leads, hora por teléfono, etc.) — nunca UI de
nombre/correo, ni botón "Editar", ni vista de solo lectura.

**Para el próximo widget:** si se agrega cualquier UI dentro de la tarjeta, no debe incluir
estos campos ni depender de `registeredData`/modo edición.

## 2. Formato de `settings` en `manifest.json` — usar objeto, no array

Formato que **ya pasó la revisión de Marketplace** (`other-leads-marketplace`):

```json
"settings": {
  "nombre": { "name": "settings.nombre", "type": "text", "required": true },
  "correo": { "name": "settings.correo", "type": "text", "required": true }
}
```

con i18n plano: `i18n/<locale>.json` → `settings.nombre` / `settings.correo`.

`phone-data-widget` actualmente usa formato **array** con i18n anidado:

```json
"settings": [
  { "type": "text", "code": "nombre", "required": true, "name": "widget.settings.nombre.name" }
]
```

Es autoconsistente y probablemente funcione, pero no es el formato que ya se validó. Si se
quiere minimizar riesgo en la revisión de Marketplace, migrar al formato objeto de arriba.

## 3. Payload de registro — sin datos del lead

```js
{ subdominio, nombre, correo, timestamp: new Date().toISOString() }
```

**Fix aplicado:** se removió `leadId` del payload (antes se enviaba
`APP.data.current_card.id`). El registro es a nivel de cuenta/instalación, no de lead
individual — no debe llevar ningún dato específico del lead actual.

## 4. Leer settings siempre con `self.get_settings(key)`

Nunca leer de inputs del DOM (`$('#km-nombre-input').val()`) ni de un estado en memoria
poblado por un GET previo. Se eliminaron `registeredData` / `isEditMode` y toda la lógica de
modo edición junto con el formulario.

## 5. Detección de subdominio

```js
this.getSubdomain = function () {
  var host = window.location.hostname;
  var parts = host.split('.');
  return parts.length >= 3 ? parts[0] : host;
};
```

## 6. Convención de endpoints por widget

- Base: `https://appscripts-server-production.up.railway.app`
- `POST /webhooks/<slug>/api/leads/register`
- `GET  /webhooks/<slug>/api/leads/check/:subdominio`

`<slug>` cambia por widget (`other_leads`, `phone_data`, ...). No hay un `/api/leads/...` sin
prefijo `webhooks/<slug>` — eso fue una corrección durante esta sesión.

## 7. `checkRegistered` — evitar registros duplicados (fail-open)

```js
this.checkRegistered = function (subdominio, callback) {
  $.ajax({
    url: CHECK_URL + encodeURIComponent(subdominio),
    method: 'GET',
    dataType: 'json',
    success: function (response) {
      callback(!!(response && (response.registered || response.exists)));
    },
    error: function () {
      callback(false); // fail-open: un error del endpoint de check no debe bloquear el registro
    }
  });
};
```

`sendToServer()` llama primero a `checkRegistered`; solo hace el POST si `alreadyRegistered`
es `false`. Este patrón ya está en `phone-data-widget`. Ojo: es distinto del viejo
`checkSubdomain` de la primera versión de `other-leads-marketplace`, que además usaba
`response.data` para **prellenar un formulario** — eso ya no aplica en ningún widget nuevo,
porque no hay formulario.

## 8. Patrón AMD / callbacks (igual en ambos widgets)

```js
define(['jquery'], function ($) {
  var CustomWidget = function () {
    var self = this;
    this.callbacks = {
      settings:     function () { return true; },
      init:         function () { /* setup propio del widget */ return true; },
      bind_actions: function () { return true; },
      render:       function () { return true; },
      onSave:       function () { self.sendToServer(); return true; },
      destroy:      function () { /* cleanup propio del widget */ }
    };
    // ...
    return this;
  };
  return CustomWidget;
});
```

## 9. XSS

Cualquier valor dinámico insertado con `.html()` debe escaparse:
`$('<s>').text(value).html()` (o `$('<span>')`, da igual el tag). `nombre`/`correo` nunca se
insertan en el DOM (no hay UI para ellos), así que ahí no aplica — pero sí aplica a cualquier
otro dato de la API que sí se renderice (nombres de leads, pipelines, estados, países, etc.).

## 10. i18n

Agregar cada string visible en **ambos** `i18n/es.json` y `i18n/en.json`. Las keys usadas en
`manifest.json` (`settings.*`, `widget.*`) deben tener la entrada correspondiente en los dos
archivos, con la misma forma (plana o anidada) que se decida usar (ver punto 2).

## 11. Gotcha de esta sesión

Este repo tiene varios widgets en ramas distintas (`feature/other-leads-marketplace`,
`feature/phone-data-widget`, etc.) con archivos del mismo nombre (`script.js`,
`manifest.json`) pero contenido completamente distinto. Antes de asumir el contenido de un
archivo por lo que se vio antes en la conversación, releerlo (`Read` o
`git show HEAD:<archivo>`) para confirmar en qué rama/estado real se está parado.
