// category-tint.js — tints the badge/tile background circle of HA state
// icons by entity category, leaving the icon color itself fully native.
// Loaded via frontend.extra_module_url, served at /local/category-tint.js.
// Controlled by the "category-tint" HA theme: active while --ct-enabled is
// set on :root; colors/opacity come from the theme's --ct-* variables.
// Resolution order per PLAN.md: device_class group -> domain -> neutral.
(() => {
  'use strict';

  const VAR_KEYS = [
    'temp', 'humid', 'thermo_matter', 'thermo_tado', 'energy',
    'net', 'opening', 'time', 'place', 'control',
  ];

  // device_class -> category (evaluated before the domain rules)
  const DC_MAP = {
    temperature: 'temp',
    temperature_delta: 'temp',
    humidity: 'humid',
    absolute_humidity: 'humid',
    moisture: 'humid',
    power: 'energy',
    apparent_power: 'energy',
    reactive_power: 'energy',
    energy: 'energy',
    energy_storage: 'energy',
    energy_distance: 'energy',
    reactive_energy: 'energy',
    power_factor: 'energy',
    voltage: 'energy',
    current: 'energy',
    frequency: 'energy',
    battery: 'energy',
    battery_charging: 'energy',
    plug: 'energy',
    connectivity: 'net',
    data_rate: 'net',
    data_size: 'net',
    signal_strength: 'net',
    speed: 'net',
    door: 'opening',
    window: 'opening',
    opening: 'opening',
    garage_door: 'opening',
    motion: 'opening',
    presence: 'opening',
    occupancy: 'opening',
    moving: 'opening',
    glass_break: 'opening',
    vibration: 'opening',
    timestamp: 'time',
    duration: 'time',
    uptime: 'time',
    date: 'time',
    distance: 'place',
  };

  // domain -> category for everything not caught by a device_class
  const DOMAIN_MAP = {
    person: 'place',
    device_tracker: 'place',
    zone: 'place',
    schedule: 'time',
    timer: 'time',
    timer_list: 'time',
    switch: 'control',
    light: 'control',
    button: 'control',
    automation: 'control',
    scene: 'control',
    script: 'control',
    input_boolean: 'control',
    input_button: 'control',
    input_datetime: 'control',
    input_number: 'control',
    input_select: 'control',
    input_text: 'control',
    number: 'control',
    select: 'control',
    text: 'control',
    update: 'control',
    event: 'control',
    alarm_control_panel: 'control',
    cover: 'control',
    fan: 'control',
    lock: 'control',
    siren: 'control',
    vacuum: 'control',
    remote: 'control',
    todo: 'control',
    calendar: 'control',
    media_player: 'control',
    camera: 'control',
    weather: 'control',
    sun: 'control',
    humidifier: 'control',
    lawn_mower: 'control',
    valve: 'control',
    water_heater: 'control', // only reached for non-thermostat layouts
    air_quality: 'control',
    image: 'control',
    notify: 'control',
    tag: 'control',
    counter: 'control',
    group: 'control',
    plant: 'control',
  };
  // sensor/binary_sensor intentionally absent: without a device_class they
  // fall through to "neutral" and get no tint.

  // Candidates that carry a circular badge/background worth tinting
  const BADGE_TAGS = 'state-badge';
  const TILE_TAGS = 'ha-tile-icon';
  const NO_TINT_STATES = new Set(['unavailable', 'unknown']);
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
    const dc = stateObj.attributes?.device_class;
    if (dc && DC_MAP[dc]) return DC_MAP[dc];

    if (domain === 'climate' || domain === 'water_heater') {
      // Platform distinguishes Matter-commissioned Tado X thermostats from
      // cloud-side Tado devices (PLAN.md). Any other climate platform lands
      // on thermo_tado — all non-matter climates here are Tado cloud.
      return h?.entities?.[entityId]?.platform === 'matter'
        ? 'thermo_matter'
        : 'thermo_tado';
    }
    return DOMAIN_MAP[domain] || 'neutral';
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
