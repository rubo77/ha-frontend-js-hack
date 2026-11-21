// category-tint.js — tints the badge/tile background circle of HA state
// icons by entity category, leaving the icon color itself fully native.
// Loaded via frontend.extra_module_url, served at /local/category-tint.js.
// Controlled by the "category-tint" HA theme: active while --ct-enabled is
// set on :root; colors/opacity come from the theme's --ct-* variables.
// Mapping data/rules live in category-tint-map.js (same directory).
import {
  DC_MAP,
  DOMAIN_MAP,
  CLIMATE_PLATFORM_CATEGORY,
  SWITCH_RULES,
  NO_TINT_STATES,
} from './category-tint-map.js';

(() => {
  'use strict';

  const VAR_KEYS = [
    'temp', 'humid', 'thermo_matter', 'thermo_tado', 'energy',
    'net', 'opening', 'time', 'place', 'control',
  ];

  // Candidates that carry a circular badge/background worth tinting
  const BADGE_TAGS = 'state-badge';
  const TILE_TAGS = 'ha-tile-icon';
  // Sections views nest badges up to ~9 shadow roots deep; keep headroom.
  const MAX_DEPTH = 14;
  const observedRoots = new WeakSet();
  let lastTheme = null;

  const hass = () => document.querySelector('home-assistant')?.hass;

  function themeConfig() {
    const style = getComputedStyle(document.documentElement);
    if (!style.getPropertyValue('--ct-enabled').trim()) return null;
    const colors = {};
    for (const key of VAR_KEYS) {
      colors[key] = style.getPropertyValue(`--ct-${key.replace(/_/g, '-')}`)
        .trim() || null;
    }
    const opacity =
      parseFloat(style.getPropertyValue('--ct-opacity')) || 0.18;
    const ring =
      parseFloat(style.getPropertyValue('--ct-ring-opacity')) || 0.85;
    return { colors, opacity, ring };
  }

  const hexToRgba = (hex, opacity) => {
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${opacity})`;
  };

  // Walk the composed tree upwards; first element exposing an entity wins.
  function entityIdOf(el) {
    let node = el;
    for (let d = 0; node && d < 12; d++) {
      const eid =
        node.stateObj?.entity_id ||
        node._stateObj?.entity_id ||
        node._config?.entity;
      if (eid) return eid;
      node =
        node.parentElement ||
        (node.getRootNode && node.getRootNode().host) ||
        null;
    }
    return null;
  }

  function categoryOf(entityId) {
    const h = hass();
    const stateObj = h?.states?.[entityId];
    if (!stateObj) return null;
    if (NO_TINT_STATES.has(stateObj.state)) return null;

    const domain = entityId.split('.')[0];
    // Pictures fill the badge themselves (brand logos, camera stills) —
    // except person avatars, which are round and read well inside a ring.
    if (stateObj.attributes?.entity_picture && domain !== 'person') {
      return null;
    }
    const dc = stateObj.attributes?.device_class;
    if (dc && DC_MAP[dc]) return DC_MAP[dc];

    if (domain === 'climate' || domain === 'water_heater') {
      // Platform distinguishes Matter-commissioned Tado X thermostats from
      // cloud-side Tado devices (PLAN.md). Any other climate platform lands
      // on thermo_tado — all non-matter climates here are Tado cloud.
      return (
        CLIMATE_PLATFORM_CATEGORY[h?.entities?.[entityId]?.platform] ||
        CLIMATE_PLATFORM_CATEGORY.default
      );
    }
    if (domain === 'switch') return switchCategory(h, entityId);
    return DOMAIN_MAP[domain] || 'neutral';
  }

  // device_id -> registry entries, rebuilt per scan() call.
  let deviceIndex = null;
  function deviceIndexOf(h) {
    if (!deviceIndex) {
      deviceIndex = new Map();
      for (const ent of Object.values(h?.entities || {})) {
        if (!ent?.device_id) continue;
        (deviceIndex.get(ent.device_id) ||
          deviceIndex.set(ent.device_id, []).get(ent.device_id)
        ).push(ent);
      }
    }
    return deviceIndex;
  }

  // The 'switch' domain is too generic to map by name, so SWITCH_RULES
  // decides from registry/device context (see category-tint-map.js).
  function switchCategory(h, entityId) {
    const ent = h?.entities?.[entityId];
    const siblings = ent?.device_id
      ? deviceIndexOf(h).get(ent.device_id) || []
      : [];
    for (const rule of SWITCH_RULES) {
      if (!rule.match(ent, siblings, h)) continue;
      return typeof rule.category === 'function'
        ? rule.category(ent, siblings, h)
        : rule.category;
    }
    return 'control';
  }

  // One stylesheet per shadowRoot containing a rule per category, keyed by
  // the data-ct attribute we set on the host.
  function ensureTileStyles(root, theme) {
    let style = root.__ctStyle;
    if (!style) {
      style = document.createElement('style');
      style.setAttribute('data-ct', '');
      root.appendChild(style);
      root.__ctStyle = style;
    }
    const rules = VAR_KEYS.map((k) => {
      const hex = theme.colors[k];
      if (!hex || hex === 'transparent') return '';
      const rgba = hexToRgba(hex, theme.opacity);
      const ring = hexToRgba(hex, theme.ring);
      return `:host([data-ct="${k}"]) .container{background-color:${rgba} !important;box-shadow:inset 0 0 0 2px ${ring} !important}` +
        `:host([data-ct="${k}"]) .container.background::before{background-color:${rgba} !important;opacity:1 !important}`;
    });
    const css = rules.join('');
    if (style.textContent !== css) style.textContent = css;
  }

  function scan(root) {
    if (!root || typeof root.querySelectorAll !== 'function') return;
    ensureObserved(root);

    const theme = themeConfig();
    if (!theme) {
      if (lastTheme) untintAll(document);
      lastTheme = null;
      return;
    }
    lastTheme = theme;
    deviceIndex = null;

    for (const el of collect(root, `${BADGE_TAGS},${TILE_TAGS}`)) {
      const entityId = entityIdOf(el);
      const cat = entityId ? categoryOf(entityId) : null;
      if (el.matches(TILE_TAGS)) {
        if (el.shadowRoot) ensureTileStyles(el.shadowRoot, theme);
        if (cat && cat !== 'neutral' && theme.colors[cat]) {
          el.dataset.ct = cat;
        } else {
          delete el.dataset.ct;
        }
      } else {
        // state-badge is already a 40px circle: inline background is enough,
        // no shadow-root injection needed.
        const hex = cat && cat !== 'neutral' ? theme.colors[cat] : null;
        if (hex) {
          const bg = hexToRgba(hex, theme.opacity);
          const ring = `inset 0 0 0 2px ${hexToRgba(hex, theme.ring)}`;
          if (el.style.backgroundColor !== bg) {
            el.style.setProperty('background-color', bg, 'important');
          }
          if (el.style.boxShadow !== ring) {
            el.style.setProperty('box-shadow', ring, 'important');
          }
        } else {
          el.style.removeProperty('background-color');
          el.style.removeProperty('box-shadow');
        }
      }
    }
  }

  function collect(root, selector) {
    const out = [];
    const walk = (r, depth) => {
      if (depth > MAX_DEPTH || !r) return;
      out.push(...r.querySelectorAll(selector));
      for (const el of r.querySelectorAll('*')) {
        if (el.shadowRoot) walk(el.shadowRoot, depth + 1);
      }
    };
    walk(root, 0);
    return out;
  }

  function untintAll(root) {
    for (const el of collect(document, '[data-ct]')) delete el.dataset.ct;
    for (const el of collect(document, BADGE_TAGS)) {
      el.style.removeProperty('background-color');
      el.style.removeProperty('box-shadow');
    }
  }

  function onMutations(mutations) {
    for (const m of mutations) {
      for (const node of m.addedNodes) {
        if (node.nodeType === Node.ELEMENT_NODE) {
          requestAnimationFrame(() => scan(node));
        }
      }
    }
  }

  function ensureObserved(root) {
    if (observedRoots.has(root)) return;
    observedRoots.add(root);
    new MutationObserver(onMutations).observe(root, {
      childList: true,
      subtree: true,
    });
  }

  ensureObserved(document.documentElement);
  scan(document);
  for (const delay of [500, 1500, 3000]) {
    setTimeout(() => scan(document), delay);
  }
  setInterval(() => scan(document), 3000);
})();
