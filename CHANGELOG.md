# Changelog

## 1.0.0

- First release: a dark mode and a light mode for the whole panel, built on the panel's own theme system, with a switch for each person in their account menu.
- Admin → Theme Studio, a preset manager. Ten built-in presets (Graphite, OLED black, Midnight, Slate, Forest, Ocean, Crimson, Rustix, Halloween with bats and Christmas with snow) that cannot be renamed or deleted but take your own primary and secondary colours, with a reset. Presets of your own with every colour, an effect (snow, bats, autumn leaves or confetti), a live preview of both schemes and a contrast warning. Duplicate any preset.
- A default preset, and schedules: a preset between two dates, every year or once, with optional times, a timezone and a priority. Halloween (15 to 31 October) and Christmas (1 to 26 December) are scheduled by default. The page shows what is on now and the coming switches.
- The server puts the active preset's colours in the page before the first paint, cached until something changes.
- An option to let people pick their own preset from their account page.
- A choice of font, corner radius, a compact density, your own logo, and how much of the effects shows. Every built-in preset passes WCAG AA contrast in both schemes, and other extensions pick up the colours on their own.
