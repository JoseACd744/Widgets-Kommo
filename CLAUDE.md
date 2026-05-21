# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A **Kommo (amoCRM) widget** that displays other leads linked to the same contact as the current lead. It also lets the user register their subdomain + contact info with an external server. The widget is injected into the lead card (`lcard-1`) inside a custom tab.

## No build step

There is no bundler, transpiler, or package manager. All files are deployed directly to the Kommo widget host. To test changes, upload the files through the Kommo developer panel or reload the widget in a live account.

## File layout

| File | Role |
|------|------|
| `manifest.json` | Kommo widget metadata: location (`lcard-1`), settings schema, locale list |
| `script.js` | All widget logic (single AMD module) |
| `style.css` | CSS — all classes prefixed `km-` |
| `i18n/es.json`, `i18n/en.json` | Localization strings for widget name, description, and settings labels |

## Kommo widget API conventions

- `script.js` must export a constructor via AMD: `define(['jquery'], function($) { ... return CustomWidget; })`.
- The `this.callbacks` object is the Kommo lifecycle hook. Only `init` and (optionally) `bind_actions`/`render`/`onSave` matter; the rest must return `true`.
- Kommo globals available at runtime: `APP.data.current_card`, `APP.data.is_card`, `APP.data.current_entity`, `APP.constant('account')`, `self.get_settings(key)`.
- jQuery is injected by Kommo — do not import it separately.
- The widget only activates for lead cards: guard with `APP.data.is_card && APP.data.current_entity === 'leads'`.

## Architecture — how `script.js` works

1. **First install flow**: `setup()` looks for a custom field named `km_contact_leads_tab` in `APP.constant('account').cf`. If missing, it creates a custom field group + a marker text field via `POST /api/v4/leads/custom_fields/groups` then reloads.
2. **Tab injection**: Once the marker field exists, `findTabAndInject()` locates the tab that contains the field's ID, then waits for the tab's DOM container (`.linked-forms__group-wrapper[data-id="<tabId>"]`) using a `MutationObserver` (15 s timeout) before calling `injectContent()`.
3. **Subdomain check**: Before rendering the UI, `checkSubdomain()` hits the external server to see if this Kommo subdomain is already registered (`GET .../check/<subdomain>`). The result sets `registeredData`.
4. **Lead fetch chain**: `fetchAndRender()` → pipelines cache → current lead → contact → all other leads for that contact (parallel individual fetches) → sorted by `created_at` desc → `renderLeads()`.
5. **Registration form**: `renderWidgetUI()` renders read-only view (if registered) or editable form. `sendToServer()` POSTs `{ subdominio, nombre, correo, timestamp, leadId }` to the Railway server.

## External dependencies

| Constant | Value | Purpose |
|----------|-------|---------|
| `SERVER_URL` | `https://appscripts-server-production.up.railway.app/webhooks/other_leads/api/leads/register` | Registration + check endpoint |
| `CSV_URL` | Google Sheets export URL | Declared but not currently used in active code |

The check endpoint is derived by replacing `register` with `check/<subdomain>` in `SERVER_URL`.

## XSS safety

User-facing strings from the API (lead names, pipeline names, status names) are escaped with `$('<s>').text(value).html()` before being injected into HTML. Keep this pattern for any new dynamic content inserted via `.html()`.

## Localization

Add new user-visible strings to both `i18n/es.json` and `i18n/en.json`. The keys map to entries in `manifest.json` (`settings.*`, `widget.*`).
