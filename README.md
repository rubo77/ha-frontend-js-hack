# ha-frontend-js-hack

Frontend experiments for Home Assistant on `nebelhaufen`, loaded via
`frontend.extra_module_url` — interim bridges until (parts of) them land in
the `ha-frontend` fork properly.

## category-tint.js (current approach)

Tints the **badge background circle** of state icons by entity category —
temperature, humidity, energy, network, openings, time, place, controls and
the two thermostat sources (Matter vs Tado). The icon color itself stays
100% native, so HA's state semantics (amber = on, grey = off, deep-orange =
heat, red = problem) keep their meaning. Two information channels:

```
[◍ tinted circle + colored ring = category]  icon color = state
```

Pure alpha fills over a white background always render pastel, so each
badge also gets a 2px inset ring at full color strength
(`--ct-ring-opacity`, default `0.85`) — the fill stays subtle while the
ring carries the actual color identity.

Resolution order per entity: `device_class` group → `domain` → *neutral*
(no tint). `climate`/`water_heater` resolve via the entity-registry platform
(`matter` → `thermo_matter`, everything else → `thermo_tado`).
Category list, colors and rationale: [PLAN.md](PLAN.md),
palette: [palette.svg](palette.svg).

### Install

```yaml
frontend:
  extra_module_url:
    - /local/category-tint.js?v=1
  themes:
    category-tint:
      ct-enabled: "1"
      ct-opacity: "0.18"
      ct-ring-opacity: "0.85"
      ct-temp: "#ef6c00"
      ct-humid: "#039be5"
      ct-thermo-matter: "#6a1b9a"
      ct-thermo-tado: "#ab47bc"
      ct-energy: "#fdd835"
      ct-net: "#3949ab"
      ct-opening: "#43a047"
      ct-time: "#90a4ae"
      ct-place: "#00897b"
      ct-control: "#795548"
```

Restart HA, select `category-tint` in your user profile → Theme. Switching
back to default removes all tints (attributes/inline styles are cleaned up).
Bump `?v=` on every file change.

## domain-icon-colors.js (v1, archived)

First iteration: injected `<style>` elements force `color`/`fill` on the
rendered SVG inside `ha-state-icon`/`state-badge` shadow roots, keyed by
entity domain to `--dic-*` theme vars. Works, but overrides the state-color
channel — superseded by the badge-tint approach. Kept for reference; theme
YAML example in git history / `PLAN.md` background section.

## Files

- `category-tint.js` — engine: DOM/shadow traversal, theme vars, tint
  application (never icon colors)
- `category-tint-map.js` — all mapping data: device-class/domain tables,
  climate platform split and the ordered `SWITCH_RULES` — edit this file
  to change categorization, no engine changes needed
