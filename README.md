# ha-frontend-js-hack

`domain-icon-colors.js` — colors Home Assistant state icons by entity domain
category, driven entirely by a theme's CSS custom properties.

## Why this exists

HA computes icon colors in JavaScript per entity state, so the usual
`--state-icon-color` theme variable cannot recolor icons by domain. This
module traverses the DOM (including nested shadow roots), detects each icon's
entity domain, and injects a `<style>` forcing `color`/`fill` on the rendered
SVG. Inactive states (`off`, `unavailable`, `unknown`, `none`) keep HA's
native coloring, so on/off toggling stays visually distinct.

## Install

1. Copy `domain-icon-colors.js` into your HA config `www/` directory.
2. Register it as a frontend module:

   ```yaml
   frontend:
     extra_module_url:
       - /local/domain-icon-colors.js?v=2
   ```

3. Define a theme that carries the `--dic-*` palette:

   ```yaml
   frontend:
     themes:
       domain-icon-colors:
         dic-enabled: "1"
         dic-light: "#ffb300"    # light
         dic-climate: "#ff7043"  # climate, water_heater
         dic-switch: "#42a5f5"   # switch, button
         dic-sensor: "#66bb6a"   # sensor, binary_sensor
         dic-media: "#ab47bc"    # media_player, sun, person, zone, camera
         dic-other: "#26a69a"    # everything else
   ```

4. Restart HA, then select `domain-icon-colors` under your user profile →
   Theme. Switching back to the default theme removes all injected styles.
   Bump `?v=` whenever you change the JS file (browser cache).

## Domain map

Edit `DOMAIN_VARS` in `domain-icon-colors.js` to remap domains to the six
`--dic-*` keys; edit the theme YAML to change colors. Unknown domains fall
back to `dic-other`.

## Deployed on

- nebelhaufen (`/root/.homeassistant/www/domain-icon-colors.js`), theme
  active for user `ruben`; repo copy lives in
  `~/nebelhaufen/homeassistant/www/` — see `~/nebelhaufen/dev/CHANGES.md`.
