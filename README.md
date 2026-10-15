# Fussy Fran

An all-in-one helper plugin for [SiYuan](https://b3log.org/siyuan/).

> Quick capture inbox + triage gallery + database badges — more coming.

## Features

* **Quick capture** (`⇧⌘Q`, configurable) — a single inbox for fleeting thoughts, saving to:
  * **Unsorted inbox** — a chosen SiYuan document, tracked with status/tags/source so you can triage later.
  * **Today's daily note** — appends your text as bullet items (found via the `custom-dailynote-*` attribute, with a fallback to the date in the doc path).
  * **Timestamp note** — creates a new doc named by epoch milliseconds in a configurable notebook/path (e.g. `/Cards`), for a zettelkasten-style workflow.
  * **Favorite database** — an Attribute View you picked; the capture is added as a row.
  * **Favorite page** — appends the capture to any document you picked.
  * Tags and an optional source URL (validated to http/https); recently used destinations are offered automatically.
* **Capture inbox (triage gallery)** — a right-bottom dock listing your captures as cards, with filters for unsorted/processed, one-by-one or bulk routing to a page/database, edit, archive, restore, and delete.
* **Database badges** — a compact, read-only row of Attribute View fields rendered under blocks that carry `custom-avs`, with caching and a per-pass cap so typing stays smooth. Fields can be hidden by name, field names can be toggled, and position/length are configurable.
* **Refresh button** (optional) — reloads the current document from the toolbar, next to the back arrow.
* **Tabbed settings dialog** — UI / Quick Capture / Database, with placeholders for upcoming Calendar/Kanban and Home Dashboard features.

## Install

1. Open SiYuan → *Settings → Marketplace → Downloaded* and install **Fussy Fran**, or
2. Download `package.zip` from the [latest release](https://github.com/PinkNinjaa/Fussy_Fran/releases), extract it into `{workspace}/data/plugins/Fussy_Fran`, then enable it in *Settings → Plugins*.

Requires SiYuan **3.8.3+**.

## Development

The plugin is built from TypeScript sources with [esbuild](https://esbuild.github.io/).

```bash
npm install        # dev dependencies: esbuild + typescript
npm run build      # bundle src/index.ts -> index.js, copy src/styles.css -> index.css
npm run dev        # rebuild on change
npm run check      # tsc --noEmit type check
```

For live testing, the plugin folder inside your workspace should point at this repo (a directory junction works well on Windows):

```powershell
# junctions need no admin on the same volume
New-Item -ItemType Junction -Path "$env:USERPROFILE\Documents\<workspace>\data\plugins\Fussy_Fran" `
         -Target "C:\Users\SalesTTNZ\Documents\Git\Fussy_Fran"
```

Then rebuild and reload the plugin in SiYuan (*Settings → Plugins*).

### Project layout

```
src/
  index.ts            plugin lifecycle, top bar, dock, settings
  styles.css          copied to index.css at build time
  siyuan.d.ts         minimal runtime type shim for the "siyuan" module
  libs/syapi.ts       thin wrappers over the SiYuan kernel HTTP API
  modules/
    captureTypes.ts   shared capture/config types
    captureStore.ts   persist + track unsorted captures
    quickCapture.ts   unified capture dialog (inbox/daily/card/database/page)
    triageGallery.ts  capture inbox dock (triage/route/archive)
    dbBadges.ts       read-only Attribute View badge row
    refreshButton.ts  toolbar refresh button
scripts/build.mjs     esbuild build script
i18n/                 en.json, zh-CN.json
```

## Configuration

Open the settings dialog (plugin settings in SiYuan, or the ⚡ top-bar menu).

| Setting | Default | Meaning |
| --- | --- | --- |
| Unsorted inbox page | — | Document used to persist unsorted captures |
| Favorite databases / pages | — | Attribute views and documents offered as capture targets |
| Quick capture shortcut | `⇧⌘Q` | Takes effect after a plugin restart |
| Cards storage path | `/Cards` | Subpath inside the cards notebook for timestamp notes |
| Default capture target | Unsorted inbox | Preselected destination in the capture dialog |
| Enable badges | on | Toggle the database badge row |
| Hidden fields | `password,private_info` | Comma-separated field names to hide |
| Show field names | on | Show the field name next to each badge |
| Max value length / position | 60 / below | Truncation length and placement of badge values |
| Expose refresh UI | off | Show the toolbar refresh button |

## Roadmap

* Calendar / Kanban / reminders view
* Home dashboard
* UI simplification toggles

## License

MIT
