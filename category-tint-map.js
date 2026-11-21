// category-tint-map.js — declarative category mapping for category-tint.js.
// Pure data + rule lists; no DOM code lives here. Edit this file to change
// what gets tinted which way, then bump ?v= in extra_module_url.

// device_class -> category (evaluated before the domain rules)
export const DC_MAP = {
  temperature: 'temp',            // room/CPU/weather thermometers
  temperature_delta: 'temp',      // temp difference sensors
  humidity: 'humid',              // room humidity: sensor.*_temp_hum (humidity part)
  absolute_humidity: 'humid',     // g/m³ humidity sensors
  moisture: 'humid',              // soil/leak moisture sensors
  power: 'energy',                // live wattage on smart plugs (W)
  apparent_power: 'energy',       // VA readings on smart plugs
  reactive_power: 'energy',       // var readings on smart plugs
  energy: 'energy',               // kWh counters: sensor.*_summation_delivered
  energy_storage: 'energy',       // battery kWh capacity
  energy_distance: 'energy',      // EV-style "energy per distance"
  reactive_energy: 'energy',      // kvarh counters
  power_factor: 'energy',         // cos-phi on smart plugs
  voltage: 'energy',              // mains voltage: sensor.*_voltage on plugs
  current: 'energy',              // amps: sensor.*_current on plugs
  frequency: 'energy',            // grid 50 Hz sensors
  battery: 'energy',              // battery % on sensors/remotes: binary_sensor.* battery low
  battery_charging: 'energy',     // charging state on phones/Tablets
  plug: 'energy',                 // binary_sensor "something is plugged in"
  connectivity: 'net',            // ping/binary reachable hosts
  data_rate: 'net',               // bandwidth Mbit/s (e.g. speedtest)
  data_size: 'net',               // MB/GB counters: disk/net throughput
  signal_strength: 'net',         // RSSI/LQI: sensor.*_rssi, *_lqi
  speed: 'net',                   // wind/vehicle speed sensors
  door: 'opening',                // door contact sensors
  window: 'opening',              // window contacts: binary_sensor.*_tuer_offen
  opening: 'opening',             // generic opening sensors
  garage_door: 'opening',         // garage door contacts
  motion: 'opening',              // motion detectors (PIR)
  presence: 'opening',            // presence/mmWave sensors
  occupancy: 'opening',           // occupancy sensors
  moving: 'opening',              // "something is moving" sensors
  glass_break: 'opening',         // glass-break detectors
  vibration: 'opening',           // vibration sensors
  timestamp: 'time',              // last-backup/last-seen timestamps
  duration: 'time',               // runtimes: poll intervals, washer runtime
  uptime: 'time',                 // sensor.uptime, device uptime
  date: 'time',                   // date-only sensors
  distance: 'place',              // distance-to-home sensors (proximity)
};

// domain -> category for everything not caught by a device_class.
// sensor/binary_sensor are intentionally absent: without a device_class
// they fall through to 'neutral' and get no tint.
// 'switch' is absent on purpose — it resolves per device via SWITCH_RULES.
export const DOMAIN_MAP = {
  person: 'place',                // persons
  device_tracker: 'place',        // phones/cars tracked by GPS
  zone: 'place',                  // zone.home
  schedule: 'time',               // schedules
  timer: 'time',                  // countdown timers
  timer_list: 'time',             // timer-list helpers
  light: 'energy',                // lamps are power consumers
  button: 'control',              // identify/restart buttons
  automation: 'control',          // automation toggles
  scene: 'control',               // scenes
  script: 'control',              // scripts
  input_boolean: 'control',       // helper toggles
  input_button: 'control',        // helper buttons
  input_datetime: 'control',      // helper datetime inputs
  input_number: 'control',        // numeric helper inputs
  input_select: 'control',        // helper dropdowns
  input_text: 'control',          // helper text inputs
  number: 'control',              // number.*_comfort_temperature_min
  select: 'control',              // select.*_display_unit, *_power_on_behavior
  text: 'control',                // text inputs
  update: 'control',              // update.*_firmware entities
  event: 'control',               // event.backup, event buttons fired
  alarm_control_panel: 'control', // alarm panels
  cover: 'control',               // blinds/shutters/garage covers
  fan: 'control',                 // fans
  lock: 'control',                // door locks
  siren: 'control',               // sirens
  vacuum: 'control',              // robot vacuums
  remote: 'control',              // IR/RF remotes
  todo: 'control',                // todo lists
  calendar: 'control',            // calendars
  media_player: 'control',        // speakers/TVs
  camera: 'control',              // cameras
  weather: 'control',             // weather entities
  sun: 'control',                 // sun.sun
  humidifier: 'control',          // (de)humidifiers
  lawn_mower: 'control',          // mower robots
  valve: 'control',               // water/gas valves
  air_quality: 'control',         // air-quality entities
  image: 'control',               // image entities (QR codes, camera stills)
  notify: 'control',              // notify entities
  tag: 'control',                 // NFC tags
  counter: 'control',             // counter helpers
  group: 'control',               // entity groups
  plant: 'control',               // plant monitors
};

// climate/water_heater -> thermo family by integration platform.
export const CLIMATE_PLATFORM_CATEGORY = {
  matter: 'thermo_matter',        // thermostats joined locally via Matter
  default: 'thermo_tado',         // thermostats via vendor cloud (e.g. Tado)
};

// Ordered rules for the ambiguous 'switch' domain. The engine walks this
// list top-down and takes the first match; `match(ent, siblings, h)` gets
// the entity's registry entry, all registry entries sharing its device_id,
// and the hass object. `category` is either a name or the same signature.
const isClimateSibling = (s) =>
  s.entity_id.startsWith('climate.') || s.entity_id.startsWith('water_heater.');

export const SWITCH_RULES = [
  {
    // config/diagnostic toggles: switch.*_network_led, identify-like
    // helpers — settings, not real actuators
    match: (ent) =>
      ent?.entity_category === 'config' ||
      ent?.entity_category === 'diagnostic',
    category: 'control',
  },
  {
    // switch sharing a device with a climate entity: switch.*_tado
    // (heating toggles on the thermostat device) -> thermo family
    match: (ent, siblings) => siblings.some(isClimateSibling),
    category: (ent, siblings, h) =>
      h?.entities?.[siblings.find(isClimateSibling).entity_id]?.platform ===
      'matter'
        ? 'thermo_matter'
        : 'thermo_tado',
  },
  {
    // switch sharing a device with power metering:
    // e.g. Zigbee plugs that also expose power/energy sensors
    match: (ent, siblings, h) =>
      siblings.some(
        (s) => DC_MAP[h?.states?.[s.entity_id]?.attributes?.device_class] === 'energy'
      ),
    category: 'energy',
  },
  {
    // every other switch: plain wall switches, toggles without metering
    match: () => true,
    category: 'control',
  },
];

// States that never get a tint.
export const NO_TINT_STATES = new Set(['unavailable', 'unknown']);
