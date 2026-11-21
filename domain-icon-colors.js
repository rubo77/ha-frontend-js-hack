// Domain icon colors — colors state icons by entity domain category.
// Loaded via frontend.extra_module_url, served at /local/domain-icon-colors.js.
// Controlled by the "domain-icon-colors" HA theme: it is active while the
// theme's --dic-* custom properties are present on :root. Colors are read
// from those variables, so the theme YAML is the single place to tweak them.
// HA computes icon colors in JS per state, so --state-icon-color cannot be
// used; instead a <style> is injected into every shadowRoot below each icon
// element, forcing color/fill on the rendered svg.
(() => {
  'use strict';

  // entity domain -> theme color variable suffix
  const DOMAIN_VARS = {
    light: 'light',
    climate: 'climate',
    water_heater: 'climate',
    switch: 'switch',
    button: 'switch',
    sensor: 'sensor',
    binary_sensor: 'sensor',
    media_player: 'media',
    sun: 'media',
    person: 'media',
    zone: 'media',
    camera: 'media',
  };
  const VAR_KEYS = ['light', 'climate', 'switch', 'sensor', 'media', 'other'];

  const ICON_TAGS = 'ha-state-icon, state-badge, ha-domain-icon';
  const MAX_DEPTH = 5;
  // States that keep HA's default (gray) icon coloring
  const INACTIVE_STATES = new Set(['off', 'unavailable', 'unknown', 'none']);
  const observedRoots = new WeakSet();
  const painted = new Set();
  let lastColors = null;

  const cssFor = (color) =>
    `ha-icon,ha-svg-icon,ha-domain-icon,ha-state-icon,state-badge,img,.iron-icon{color:${color} !important}` +
    `svg{color:${color} !important;fill:${color} !important}`;

  // Returns {enabled, colors} from the theme variables on :root.
  function themeConfig() {
    const style = getComputedStyle(document.documentElement);
    if (!style.getPropertyValue('--dic-enabled').trim()) {
      return null;
    }
    const colors = {};
    for (const key of VAR_KEYS) {
      colors[key] = style.getPropertyValue(`--dic-${key}`).trim() || null;
    }
    return colors;
  }

  function domainOf(el) {
    const entityId = el.stateObj?.entity_id;
    if (entityId) return entityId.split('.')[0];
    return el.domain || el.getAttribute('domain') || null;
  }

  // Inject (or update) the color stylesheet into every shadowRoot below el.
  function paint(el, color) {
    const css = cssFor(color);
    const walk = (root, depth) => {
      if (depth > MAX_DEPTH || !root) return;
      let style = root.__dicStyle;
      if (!style) {
        style = document.createElement('style');
        style.setAttribute('data-dic', '');
        root.appendChild(style);
        root.__dicStyle = style;
      }
      style.textContent = css;
      for (const child of root.querySelectorAll('*')) {
        if (child.shadowRoot) walk(child.shadowRoot, depth + 1);
      }
    };
    if (el.shadowRoot) walk(el.shadowRoot, 0);
    painted.add(el);
  }

  function unpaint(el) {
    const walk = (root, depth) => {
      if (depth > MAX_DEPTH || !root) return;
      const style = root.__dicStyle;
      if (style) {
        style.remove();
        root.__dicStyle = null;
      }
      for (const child of root.querySelectorAll('*')) {
        if (child.shadowRoot) walk(child.shadowRoot, depth + 1);
      }
    };
    if (el.shadowRoot) walk(el.shadowRoot, 0);
    el.__dicColor = undefined;
    painted.delete(el);
  }

  function unpaintAll() {
    for (const el of painted) unpaint(el);
    painted.clear();
  }

  // Scan a DOM subtree (element or shadowRoot): paint icons and register
  // observers + recurse into every shadowRoot found.
  function scan(root) {
    if (!root || typeof root.querySelectorAll !== 'function') return;
    ensureObserved(root);

    const colors = themeConfig();
    if (!colors) {
      if (painted.size) unpaintAll();
      lastColors = null;
      return;
    }
    if (JSON.stringify(colors) !== JSON.stringify(lastColors)) {
      // Theme colors changed: repaint everything.
      unpaintAll();
      lastColors = colors;
    }

    const candidates = [];
    if (root.matches && root.matches(ICON_TAGS)) candidates.push(root);
    candidates.push(...root.querySelectorAll(ICON_TAGS));

    for (const el of candidates) {
      const domain = domainOf(el);
      if (!domain) continue;
      // Inactive states keep their default rendering so on/off stays
      // visually distinct (gray/off vs colored/on).
      const state = el.stateObj?.state;
      if (state !== undefined && INACTIVE_STATES.has(state)) {
        el.__dicColor = undefined;
        if (painted.has(el)) unpaint(el);
        continue;
      }
      const key = DOMAIN_VARS[domain] ?? 'other';
      const color = colors[key];
      // Always repaint: inner shadowRoots (ha-icon > ha-svg-icon > svg) can
      // appear after the icon element was first painted, and Lit re-renders
      // must not lose the injected styles.
      if (color) paint(el, color);
    }

    for (const el of root.querySelectorAll('*')) {
      if (el.shadowRoot) scan(el.shadowRoot);
    }
  }

  function onMutations(mutations) {
    for (const m of mutations) {
      for (const node of m.addedNodes) {
        if (node.nodeType === Node.ELEMENT_NODE) {
          // rAF lets custom elements upgrade before we look for shadowRoots
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

  // Shadow-DOM mutations are invisible to the document observer, so poll.
  // HA renders asynchronously after page load; rescan a few times early.
  for (const delay of [500, 1500, 3000]) {
    setTimeout(() => scan(document), delay);
  }
  setInterval(() => scan(document), 3000);
})();
