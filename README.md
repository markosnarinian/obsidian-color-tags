# Color Tags

Tag **folders and notes** with color, straight from the right-click menu — using
the same seven colors macOS Finder uses for its tags.

## Features

- Right-click any folder or note → **Color tag** → pick one of the **seven Finder
  colors**: Red, Orange, Yellow, Green, Blue, Purple, Gray.
- The item's name, and a folder's collapse chevron, are tinted in the tag color,
  with a subtle matching wash behind the row.
- **Your theme's look is left alone.** The plugin only changes color — it never
  touches the shape, corner radius, padding or size of a row, so the hover
  overlay on a tagged item looks exactly like the one on an untagged item.
- **Remove color** anytime from the same menu.
- Tags persist across restarts, and follow the item when it is **renamed or
  moved** — including everything inside a renamed folder.
- Works on desktop and mobile (mobile uses a swatch picker dialog).

## Usage

1. In the file explorer, **right-click** a folder or a note.
2. Hover **Color tag** and choose a color.
3. To clear it, right-click again → **Color tag** → **Remove color**.

## Installation

### Manual installation

1. Download `main.js`, `manifest.json` and `styles.css` from the
   [latest release](https://github.com/markosnarinian/obsidian-color-tags/releases/latest).
2. Create the plugin folder in your vault: `<your-vault>/.obsidian/plugins/color-tags/`
3. Copy the three files into that folder.
4. In Obsidian, go to **Settings → Community plugins** and enable **Color Tags**.

## Notes

- Tags are stored in the plugin's own `data.json`, keyed by vault path — your
  notes' content is never touched.
- This plugin does **not** read or write real macOS Finder tags. It borrows
  Finder's palette so the colors feel familiar; the tags themselves live only
  inside your vault, which means they work identically on Windows, Linux and
  mobile.

## Development

```bash
npm install
npm run dev    # watch build
npm run build  # type-check and produce a minified main.js
```

The source lives in `src/`. `main.js` at the repo root is a build output and is
not tracked in git; it is attached to each GitHub release.

## Credits

Color Tags is a fork of [**Color Marker**](https://github.com/ruisloan/obsidian-color-marker)
by **Central Brain Trust** ([centralbraintrust.com](https://www.centralbraintrust.com)),
which is MIT-licensed. The original plugin's context-menu integration, path-keyed
storage and rename/move tracking are its work, and this fork would not exist
without it.

This fork changes the palette to the macOS Finder tag colors, removes the colored
dot, stops the plugin from altering the shape of file explorer rows, tints folder
chevrons, and moves the source to TypeScript.

## License

MIT — see [LICENSE](LICENSE). The original copyright is retained alongside this
fork's.
