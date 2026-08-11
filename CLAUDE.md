# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A **Kommo (amoCRM) widget** that shows the local time and country flag next to every phone
number field, based on the number's calling code. It also registers the installer's
subdomain + contact info (name/email, entered in the widget's Kommo settings panel) with an
external server. The widget runs inside both the lead card (`lcard-1`) and the contact card
(`ccard-1`).

## No build step

There is no bundler, transpiler, or package manager. All files are deployed directly to the
Kommo widget host. To test changes, upload the files through the Kommo developer panel or
reload the widget in a live account.

## File layout

| File | Role |
|------|------|
| `manifest.json` | Kommo widget metadata: locations (`lcard-1`, `ccard-1`), settings schema, locale list, tour |
| `script.js` | All widget logic (single AMD module) |
| `style.css` | CSS — all classes prefixed `km-`, dark theme via `:root[data-color-scheme="dark"]` |
| `i18n/es.json`, `i18n/en.json` | Localization strings for widget name, description, and settings labels |

## Kommo widget API conventions

- `script.js` must export a constructor via AMD: `define(['jquery'], function($) { ... return CustomWidget; })`.
- The `this.callbacks` object is the Kommo lifecycle hook. `init` fires once on page load;
  `render` fires on every card (re)render — including SPA navigation between different
  leads/contacts, which does **not** re-run `init`. Anything that needs to happen per-card
  (scanning for phone fields) must be wired into `render`, not just `init`.
- This widget targets **both** lead and contact cards, so guard with `APP.data.is_card` only —
  do not add an `APP.data.current_entity === 'leads'` check here (that's for lead-only widgets).
- Kommo globals available at runtime: `APP.data.current_card`, `APP.data.is_card`,
  `APP.data.current_entity`, `self.get_settings(key)`.
- jQuery is injected by Kommo — do not import it separately.

## Architecture — how `script.js` works

1. **Phone Time badges**: `PT_MAP` maps calling codes (`+1`, `+593`, ...) to `[ISO2, country
   name, UTC offset minutes]`. `renderPhoneBadges()` scans `.control-phone__formatted` inputs,
   parses each value with `parsePhoneData()`, and injects a `.km-phone-time` badge (flag +
   local clock + hover tooltip) right after the input via `injectPhoneBadge()`.
2. **Per-card scan**: `scanPhoneBadges()` retries the scan at 500 ms and 1.5 s (phone fields
   can be lazy-loaded). It runs from `init` (first load) and from `render` (every subsequent
   card open). `setupPhoneTime()` (called only from `init`) additionally starts a
   once-only `setInterval` that recomputes the displayed clock every 60 s via
   `updatePhoneTimes()`; `destroyPhoneTime()` tears both down.
3. **Registration**: `nombre`/`correo` are collected via the widget's Kommo settings panel
   (`manifest.json` → `settings.nombre`/`settings.correo`), never via UI in the lead/contact
   card. The `onSave` lifecycle callback (fired when the settings panel is saved, i.e. on
   install/reconfiguration) calls `sendToServer()`, which reads the values with
   `self.get_settings(key)`, resolves the subdomain with `getSubdomain()`, calls
   `checkRegistered()` first, and — only if not already registered — POSTs
   `{ subdominio, nombre, correo, timestamp }` to `SERVER_URL`. No lead/contact data is ever
   included in that payload.

## External dependencies

| Constant | Value | Purpose |
|----------|-------|---------|
| `SERVER_URL` | `https://appscripts-server-production.up.railway.app/webhooks/phone_data/api/leads/register` | Registration endpoint (POST on settings save) |
| `CHECK_URL` | `https://appscripts-server-production.up.railway.app/webhooks/phone_data/api/leads/check/` | Dedup check endpoint (GET `CHECK_URL + subdominio`); fail-open (a check error still allows registration) |
| `https://flagcdn.com/w20/<iso2>.png` | — | Country flags for the phone badge |

## XSS safety

User-facing strings that come from data (currently just the `PT_MAP` country name) are
escaped with `$('<span>').text(value).html()` before being injected into HTML. Keep this
pattern for any new dynamic content inserted via `.html()`.

## Localization

Add new user-visible strings to both `i18n/es.json` and `i18n/en.json`. The keys map to
entries in `manifest.json` (`settings.*`, `widget.*`).
