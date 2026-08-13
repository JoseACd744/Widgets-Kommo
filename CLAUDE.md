# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A **Kommo (amoCRM) widget** that shows the local time and country flag next to every phone
number field, based on the number's calling code. It also registers the installer's
subdomain + contact info (name/email/phone, entered in the widget's Kommo settings panel)
with an external server. The widget runs inside both the lead card (`lcard-1`) and the
contact card (`ccard-1`).

This widget is published as a full **public integration** (OAuth), not a plain manifest-only
widget — Kommo requires a Redirect URL and an access-revoked webhook for that install flow.
Both live server-side in the `Appscripts-server` repo (`src/domains/phone_data/oauthService.js`
+ the `/oauth/callback` and `/oauth/revoked` routes), tied to their own Kommo integration
(`PHONE_DATA_KOMMO_CLIENT_ID`/`_SECRET`/`_REDIRECT_URI` env vars — do not reuse `other_leads`'
credentials, each public integration has its own). Nothing OAuth-related lives in this repo;
`script.js` never sees a token.

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
| `images/logo*.png`, `images/icon*.svg` | Marketplace branding assets (Holos purple `#2F2864`, see below) |
| `images/slideshow_*_{en,es}.jpg` | Marketplace gallery/tour images (1188×616), referenced from `manifest.json` → `tour.tour_images` |
| `images/tour/*.jpg` | Raw/source screenshots used to build the `slideshow_*` images — not referenced by the manifest directly |

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
   name, UTC offset minutes]` (the country name is kept in the map for reference/debugging but
   is not rendered — it varies by language and isn't localized). `renderPhoneBadges()` scans
   `.control-phone__formatted` inputs, parses each value with `parsePhoneData()`, wraps just the
   input (not its siblings, e.g. an "add phone" button) in its own `.km-phone-time__row`
   inline-flex span so the badge always sits beside it rather than depending on the original
   parent's layout, and injects a `.km-phone-time` badge (flag + local clock, no label) right
   after the input via `injectPhoneBadge()`.
2. **Per-card scan**: `scanPhoneBadges()` retries the scan at 500 ms and 1.5 s (phone fields
   can be lazy-loaded). It runs from `init` (first load) and from `render` (every subsequent
   card open). `setupPhoneTime()` (called only from `init`) additionally starts a
   once-only `setInterval` that recomputes the displayed clock every 60 s via
   `updatePhoneTimes()`; `destroyPhoneTime()` tears both down.
3. **Registration**: `nombre`/`correo`/`telefono` are collected via the widget's Kommo
   settings panel (`manifest.json` → `settings.nombre`/`settings.correo`/`settings.telefono`,
   all `required: true`), never via UI in the lead/contact card. The `onSave` lifecycle
   callback (fired when the settings panel is saved, i.e. on install/reconfiguration) calls
   `sendToServer()`, which reads the values with `self.get_settings(key)`, resolves the
   subdomain with `getSubdomain()`, calls `checkRegistered()` first, and — only if not already
   registered — POSTs `{ subdominio, nombre, correo, telefono, timestamp }` to `SERVER_URL`.
   No lead/contact data is ever included in that payload.

## External dependencies

| Constant | Value | Purpose |
|----------|-------|---------|
| `SERVER_URL` | `https://appscripts-server-production.up.railway.app/webhooks/phone_data/api/leads/register` | Registration endpoint (POST on settings save) |
| `CHECK_URL` | `https://appscripts-server-production.up.railway.app/webhooks/phone_data/api/leads/check/` | Dedup check endpoint (GET `CHECK_URL + subdominio`); fail-open (a check error still allows registration) |
| `https://flagcdn.com/w20/<iso2>.png` | — | Country flags for the phone badge |

## XSS safety

No `PT_MAP` data is currently rendered as text (only the flag image `src` and the computed
clock string are injected). If any new dynamic content from data is added to the badge HTML,
escape it first with `$('<span>').text(value).html()` before injecting via `.html()`.

## Localization

Add new user-visible strings to both `i18n/es.json` and `i18n/en.json`. The keys map to
entries in `manifest.json` (`settings.*`, `widget.*`), including `settings.telefono`.

## Marketplace assets

- **Branding**: Holos purple `#2F2864` background, white phone+clock pictogram, `holos.`
  wordmark (pink dot). Required PNG sizes: `logo_main.png` 400×272, `logo_medium.png` 240×84,
  `logo.png` 130×100, `logo_small.png` 108×108, `logo_min.png` 84×84. `icon.svg` (purple) is
  the left-menu icon for the light theme; `icon_dark.svg` (white) is the dark-theme variant —
  Kommo's dark theme is `:root[data-color-scheme="dark"]` (see `developers.kommo.com/docs/dark-theme`),
  not a made-up convention.
- **Gallery/tour images** (`images/slideshow_*_{en,es}.jpg`, 1188×616): built from real
  screenshots of the widget running inside Kommo (in `images/tour/`), not illustrated mockups —
  keep it that way if these get regenerated.
- **PII in screenshots**: any real Kommo screenshot used for marketing (in `images/tour/` or
  baked into `slideshow_*`) must have the contact name blurred and the phone number blurred
  except for the leading country code (e.g. `+593` stays, the rest is Gaussian-blurred). Do
  this before cropping into the final gallery image, not after — check `images/tour/*.jpg`
  directly if new screenshots are added.
