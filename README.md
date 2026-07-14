# Color Marker

Mark **folders and notes** with color labels, straight from the right-click
menu — so the important ones jump out at you in the file explorer.

## Features

- Right-click any folder or note → **Color marker** → pick one of **12
  calendar-style colors** (Tomato, Cherry, Flamingo, Tangerine, Banana, Sage,
  Basil, Peacock, Blueberry, Lavender, Grape, Graphite).
- The item's name is tinted and gets a **colored dot**, Google
  Calendar-label style.
- **Remove color** anytime from the same menu.
- Colors persist across restarts, and follow the item when it is
  **renamed or moved** (including everything inside a renamed folder).
- Works on desktop and mobile (mobile uses a swatch picker dialog).

## Usage

1. In the file explorer, **right-click** a folder or a note.
2. Hover **Color marker** and choose a color.
3. To clear it, right-click again → **Color marker** → **Remove color**.

## Installation

### Manual installation

1. Create the plugin folder in your vault:
   `<your-vault>/.obsidian/plugins/color-marker/`
2. Copy `main.js`, `manifest.json` and `styles.css` into that folder.
3. In Obsidian, go to **Settings → Community plugins** and enable
   **Color Marker**.

## Notes

- Colors are stored in the plugin's own `data.json`, keyed by vault path —
  your notes' content is never touched.

## License

MIT
