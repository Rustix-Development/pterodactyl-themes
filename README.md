# Theme Studio

A free, open source theme for the Pterodactyl 2.0 panel. It gives the whole panel a proper dark mode and a light mode, ships ten presets, lets you make your own, and switches to Halloween or Christmas on a schedule, with bats and falling snow.

It is built on the panel's own theme system, so it changes colours, fonts and shapes only. Every page works the way it always has, and other extensions pick up the colours on their own.

## Features

- **Dark and light.** Every preset has a dark and a light version. Everyone switches for themselves with the sun and moon button in the top bar, and the panel remembers it.
- **Ten built-in presets.** Graphite (the default), OLED black, Midnight, Slate, Forest, Ocean, Crimson, Rustix, Halloween (bats) and Christmas (snow). They cannot be renamed or deleted, but you can change their primary and secondary colours and reset them to the original at any time.
- **Presets of your own.** Create, edit, duplicate and delete them under **Admin → Theme Studio**. Set a name, an effect (none, snow, bats, autumn leaves or confetti), and for each scheme a background, surface, text, primary and secondary colour, plus optional success, warning and danger colours. Duplicate any preset, built-in or not, to start from it.
- **A live preview.** The editor shows both schemes as you type and warns about any pair of colours that falls short of WCAG AA (4.5:1 for text, 3:1 for buttons). Text on a coloured button switches between black and white on its own, and a missing secondary is worked out from the primary so links stay readable.
- **A default and schedules.** One preset is the panel's default. Schedules turn a preset on between two dates, every year or once, with optional start and end times, a timezone (the panel's unless you pick one) and a priority for when they overlap. A schedule can run over new year, such as 20 December to 5 January. Halloween (15 to 31 October) and Christmas (1 to 26 December) are scheduled out of the box; disable or change them like any other. The admin page shows what is on now and the next switches.
- **No flash of the wrong colours.** The server works out the preset that is on (a person's own pick, else a schedule, else the default) and the stylesheet loads its colours before the page first paints. Saving a preset or schedule shows on the next page load.
- **People can pick their own.** Turn on **Let people pick their own preset** and everyone gets a Theme preset card on their account page. Their pick beats the schedule; "The panel's choice" goes back to it.
- **Effects.** Snow, bats, leaves or confetti draw on one canvas with a capped number of particles (fewer on phones), pause while the tab is in the background, never get in the way of a click, and are switched off for anyone who has reduced motion turned on.
- **A few extras.** Pick a font (the panel's IBM Plex Sans, Inter, JetBrains Mono, or the device's own), set the corner radius, switch to a compact density, and upload your own logo.
- **Flat and readable.** Solid colours, no gradients and no glows. Every built-in preset passes WCAG AA in both schemes, and the tests check it.

## Install

1. Download `themes-<version>.pteroext` from the [latest release](https://github.com/Rustix-Development/pterodactyl-themes/releases/latest).
2. In the panel, go to **Admin → Extensions**, upload the file and enable it.
3. Go to **Admin → Themes** and choose **Theme Studio**. Use **Preview for me** first if you want to try it without switching everyone.

From a terminal instead:

```sh
php artisan p:extension:install /path/to/themes-<version>.pteroext --enable
php artisan p:theme:activate themes
```

Requires Pterodactyl Panel 2.0 beta 1 or later and PHP 8.3. To go back to the stock look, choose **Classic** under **Admin → Themes** (or run `php artisan p:theme:reset`).

## Theme Studio

**Admin → Theme Studio** appears while Theme Studio is the active theme, or while you preview it.

| Part | What it does |
| --- | --- |
| On now | The preset in use right now and why: the default or a schedule, and until when. |
| Default preset | On whenever no schedule is. |
| Let people pick their own preset | Adds the Theme preset card to everyone's account page. |
| Presets | Every preset with its colours. Customise or edit, duplicate, make default, delete (your own only, and not the default). |
| Schedules | Add, edit, enable, disable and delete. Deleting a preset deletes its schedules. |
| Coming up | The next times the preset in use changes, over the coming year. |

## Settings

Open **Admin → Themes**, then **Settings** on Theme Studio.

| Setting | What it does |
| --- | --- |
| Effects | Off, Subtle or Full: how much of a preset's effect shows. |
| Font | IBM Plex Sans, Inter, JetBrains Mono or the device's own. |
| Corner radius | 0 for square corners, up to 1.25rem. |
| Density | Comfortable or Compact. |
| Logo | Shown in place of the panel's name. PNG, JPEG, WebP, GIF, AVIF or SVG. |

## How it works

Presets and schedules live in the `ext_themes_presets` and `ext_themes_schedules` tables. The built-in presets' own colours are in `resources/presets.json`, which the server and the editor both read; their rows store only an admin's overrides. The theme's stylesheet starts with `@import url('/extensions/themes/preset.css')`. That route answers with the active preset's colours as a handful of custom properties, which the stylesheet turns into every colour the panel uses. It is cached on the server until something is saved, and browsers revalidate it with an ETag on every load. If it cannot load, the panel falls back to Graphite.

## Building from source

```sh
npm install
npm run build                           # writes dist/
npm test                                # contrast, editor, schedules, effects and layouts
PANEL=/path/to/panel npm run test:php   # presets, schedules, the resolver and the stylesheet
```

After changing `resources/presets.json`, run `npm run palettes` to rewrite `src/client/palettes.css` and `tests/fixtures/seeds.json` (the PHP tests compare the server's colours against it), and `npm run contrast` to see each preset's lowest contrast. To pack an archive, run `php artisan p:extension:pack <path-to-this-folder>` from a panel checkout.

## Credits

[Inter](https://rsms.me/inter/) and [JetBrains Mono](https://www.jetbrains.com/lp/mono/) are bundled under the SIL Open Font License (see `src/client/fonts`).

This is a community theme and is not affiliated with or endorsed by Pterodactyl. MIT licensed.
