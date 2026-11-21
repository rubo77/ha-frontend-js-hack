# Plan — Kategorie-Tint für Icon-Hintergrundkreise

## Ziel

Gerätetyp auf einen Blick erkennbar machen, wo HA heute eine einheitliche
blaugraue Icon-Masse zeigt. Löst das Problem „was ist das für ein Gerät",
ohne HA's State-Farbsemantik anzufassen.

## Nicht-Ziele / harte Regeln

- **Icon-Farbe bleibt unverändert.** State-Farben (amber = an, grau = aus,
  deep-orange = heat, rot = Problem, grün = home …) behalten ihre Bedeutung.
- **Kein Farbfeuerwerk:** max. ~10 Kategorien, dezente Opacity.
- `unavailable`/`unknown` bleiben unverändert grau (Icon + kein Tint).
- On/Off-Unterscheidung bleibt allein die Icon-Farbe — kein Extra-Glow nötig.

## Mechanismus

Der `state-badge`-Kreis (und der Tile-Icon-Container) bekommt eine
**Hintergrund-Tönung in der Kategoriefarbe** (niedrige Opacity, wie der
native Tile-Glow). Icon darin rendert weiterhin nativ.

```
[○ Tint=Kategorie]  Icon-Farbe = State  →  Typ UND Zustand auf einen Blick
```

## Kategorien (Reihenfolge = Auflösung)

Kategorie-Auflösung pro Entity: **explizite Regel → device_class → domain
→ neutral (kein Tint)**.

| # | Kategorie | Farbe | Quelle | Beispiele hier |
|---|-----------|-------|--------|----------------|
| 1 | `temp` | `#ef6c00` Orange | device_class `temperature` | `sensor.*_temp_hum` (Temp) |
| 2 | `humid` | `#039be5` Hellblau | device_class `humidity`, `moisture`, `absolute_humidity` | Hum-Anteile |
| 3 | `thermo_matter` | `#6a1b9a` Dunkel-Lila | domain `climate`/`water_heater` + Plattform `matter` | `climate.wohnzimmer_matter`, `climate.fussbodenheizung_matter` |
| 4 | `thermo_tado` | `#ab47bc` Violett | domain `climate`/`water_heater` + Plattform `tado` | `climate.keller_keller` u. a. |
| 5 | `energy` | `#fdd835` Gelb | dc `power, energy, energy_storage, apparent_power, reactive_power(_energy), power_factor, voltage, current, frequency, battery, battery_charging, plug` | Steckdosen-Sensoren, Akkus |
| 6 | `net` | `#3949ab` Indigo | dc `connectivity, data_rate, data_size, signal_strength, speed` | speedtest, Ping, RSSI |
| 7 | `opening` | `#43a047` Grün | dc `door, window, opening, garage_door, motion, presence, occupancy, moving, glass_break, vibration` | Tür/Fenster-Contacts |
| 8 | `time` | `#90a4ae` Blau-Grau | dc `timestamp, duration, uptime, date`; domains `schedule, timer` | Uptime, Backup-Zeiten |
| 9 | `place` | `#00897b` Teal | domains `person, device_tracker, zone`; dc `distance` | person.ruben, zone.home, Pixel-Tracker |
| 10 | `control` | `#c2185b` Pink | domains `switch, light, button, automation, scene, script, input_*, number, select, text, update, event, alarm_control_panel, cover, fan, lock, siren, vacuum, remote, todo, calendar` | Schalter, Buttons, Automationen |
| — | *neutral* | `transparent` | alles ohne Regel | klassenlose `sensor.*` |

Farblogik gegen die native HA-Palette geprüft (`#f44336` error,
`#ffc107` active, `#9e9e9e` inactive, `#44739e` icon-default,
`#ff6f22` climate-heat, `#3f51b5` sun, `#4caf50` person-home):
kein Rot/Rot-Orange (`#e64a19` verworfen — zu nah an error), `temp`
bleibt reines Orange; `thermo_matter`/`thermo_tado` bilden **eine**
Lila-Familie in zwei Tönen (dunkel + blaustich = Matter, hell + pinkstich = Tado) — bewusst
sehr ähnlich, weil beides Thermostate sind und sich nur die Quelle
unterscheidet. `net` Indigo `#3949ab` liegt nah am nativen
sun-Indigo `#3f51b5` — akzeptiert, weil Tint-Kanal ≠ Icon-Kanal und
`sun` auf Dashboards kaum vorkommt. `control` Pink und `place` Teal
stehen beide frei von nativen State-Farben.

**Auflösungsdetails:**
- `thermo_matter` vs `thermo_tado`: Plattform aus der Entity-Registry
  (`hass.entities[entity_id].platform` im Frontend) — nicht über Namensmuster.
- dc-Kategorien (1–2, 5–8) schlagen domain-Kategorien (3–4, 9–10).
- `sensor.*_temp_hum` liefert Temp+Humidity als getrennte Entities bzw.
  Attribute — pro angezeigtem Wert wird die passende Klasse benutzt
  (`stateObj.attributes.device_class`, Fallback: Attributname).

## Theme-Variablen

Das Theme liefert nur die Palette; Mechanik ist Modul/Code-Sache:

```yaml
frontend:
  themes:
    category-tint:
      --ct-enabled: "1"
      --ct-opacity: "0.18"
      --ct-ring-opacity: "0.85"
      --ct-temp: "#ef6c00"
      --ct-humid: "#039be5"
      --ct-thermo-matter: "#6a1b9a"
      --ct-thermo-tado: "#ab47bc"
      --ct-energy: "#fdd835"
      --ct-net: "#3949ab"
      --ct-opening: "#43a047"
      --ct-time: "#90a4ae"
      --ct-place: "#00897b"
      --ct-control: "#c2185b"
      --ct-neutral: "transparent"
```

Theme aus = kein Tint, exakt Stock-HA.

## Umsetzungsphasen

1. **JS-Modul (dieser Hack, hier im Repo):** DOM/Shadow-DOM-Traversal,
   Kategorie je Icon auflösen, Tint als `background`/Ring-Style injizieren.
   Gleiches Gerüst wie der alte Hack, Ziel geändert: Badge-Background statt
   Icon-Fill. Platform-Lookup via `hass.entities` (Registry) für
   Matter-vs-Tado.
2. **Verifikation:** Dashboard `/theme-test` auf nebelhaufen — alle Kategorien
   sichtbar, Icon-Farben nativ, On/Off-Toggle am Schalter prüfen.
3. **Frontend-Fork** (`/var/www/ha-frontend`): Tint nativ in `state-badge`/
   `ha-tile-icon` implementieren — CSS-Var `--ct-*`-Familie statt DOM-Hack.
4. **Upstream** (optional): generischer Mechanismus
   (`--state-{domain}-badge-color` o.ä.), ohne Hardcoded-Kategorien.

## Abnahme

- `/theme-test`: jede Kategorie hat sichtbar anderen Kreis-Tint; Icon-Farben
  unverändert (switch on = amber, off = grau).
- `climate.*_matter` ≠ `climate.*_tado` am Tint erkennbar.
- Temp-Sensor ≠ Humidity-Sensor am Tint erkennbar.
- Theme-Wechsel zurück auf Default = komplett natives Bild.
