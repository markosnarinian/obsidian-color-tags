"use strict";

/*
 * Color Marker — Obsidian plugin
 * Right-click any folder or note in the file explorer and pick one of 12
 * calendar-style colors to mark it. The item's name is tinted and gets a
 * colored dot, so you can spot it instantly. Colors can be changed or
 * removed at any time and survive restarts, renames and moves.
 *
 * This file is the plain JavaScript build (CommonJS), ready to be used by
 * Obsidian without any compilation. The TypeScript source is in main.ts.
 */

const obsidian = require("obsidian");

// 12-color palette inspired by Google Calendar.
// Each color has an emoji: native OS menus (macOS) only render text/emoji,
// so the emoji doubles as the color swatch in the context menu.
const COLORS = [
  { name: "Tomato", value: "#D50000", emoji: "🍅" },
  { name: "Cherry", value: "#D81B60", emoji: "🍒" },
  { name: "Flamingo", value: "#E67C73", emoji: "🦩" },
  { name: "Tangerine", value: "#F4511E", emoji: "🍊" },
  { name: "Banana", value: "#F6BF26", emoji: "🍌" },
  { name: "Sage", value: "#33B679", emoji: "🌿" },
  { name: "Basil", value: "#0B8043", emoji: "🌱" },
  { name: "Peacock", value: "#039BE5", emoji: "🦚" },
  { name: "Blueberry", value: "#3F51B5", emoji: "🫐" },
  { name: "Lavender", value: "#7986CB", emoji: "💜" },
  { name: "Grape", value: "#8E24AA", emoji: "🍇" },
  { name: "Graphite", value: "#616161", emoji: "⚫" },
];

// "#D50000" -> "213,0,0" (for translucent pill backgrounds in CSS).
function hexToRgb(hex) {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!m) return "128,128,128";
  return parseInt(m[1], 16) + "," + parseInt(m[2], 16) + "," + parseInt(m[3], 16);
}

const MARK_CLASS = "color-marker-item";

class ColorMarkerPlugin extends obsidian.Plugin {
  async onload() {
    const data = await this.loadData();
    // Map of vault path -> hex color.
    this.colors = (data && data.paths) || {};

    // "Color marker" entry in the right-click menu of files AND folders.
    this.registerEvent(
      this.app.workspace.on("file-menu", (menu, file) => {
        menu.addItem((item) => {
          item.setTitle("Color marker").setIcon("palette");
          if (typeof item.setSubmenu === "function") {
            // Desktop: proper submenu with the 12 swatches.
            this.buildColorMenu(item.setSubmenu(), file);
          } else {
            // Fallback (older/mobile): open a small swatch modal instead.
            item.onClick(() => new ColorPickerModal(this.app, this, file).open());
          }
        });
      })
    );

    // Keep colors attached to items when they are renamed or moved.
    this.registerEvent(
      this.app.vault.on("rename", (file, oldPath) => {
        let changed = false;
        for (const path of Object.keys(this.colors)) {
          if (path === oldPath || path.startsWith(oldPath + "/")) {
            this.colors[file.path + path.slice(oldPath.length)] = this.colors[path];
            delete this.colors[path];
            changed = true;
          }
        }
        if (changed) this.saveColors().then(() => this.applyAll());
      })
    );

    // Clean up colors of deleted items.
    this.registerEvent(
      this.app.vault.on("delete", (file) => {
        if (this.colors[file.path]) {
          delete this.colors[file.path];
          this.saveColors();
        }
      })
    );

    // Paint the explorer now and whenever it re-renders.
    this.app.workspace.onLayoutReady(() => {
      this.watchExplorers();
      this.applyAll();
    });
    this.registerEvent(
      this.app.workspace.on("layout-change", () => {
        this.watchExplorers();
        this.applyAll();
      })
    );
  }

  onunload() {
    document.querySelectorAll("." + MARK_CLASS).forEach((el) => {
      el.classList.remove(MARK_CLASS);
      el.style.removeProperty("--color-marker");
      el.style.removeProperty("--color-marker-rgb");
    });
  }

  // Builds the swatch list inside a Menu (used by the submenu).
  buildColorMenu(menu, file) {
    const current = this.colors[file.path];
    for (const c of COLORS) {
      menu.addItem((item) => {
        item
          .setTitle(c.emoji + " " + c.name)
          .onClick(() => this.setColor(file.path, c.value));
        if (typeof item.setChecked === "function") {
          item.setChecked(current === c.value);
        }
      });
    }
    menu.addSeparator();
    menu.addItem((item) =>
      item
        .setTitle("Remove color")
        .setIcon("x")
        .setDisabled(!current)
        .onClick(() => this.setColor(file.path, null))
    );
  }

  async setColor(path, color) {
    if (color) this.colors[path] = color;
    else delete this.colors[path];
    await this.saveColors();
    this.applyAll();
  }

  saveColors() {
    return this.saveData({ paths: this.colors });
  }

  // Re-applies colors whenever the file explorer re-renders its tree.
  watchExplorers() {
    if (!this.observer) {
      this.observer = new MutationObserver(() => this.scheduleApply());
      this.register(() => this.observer.disconnect());
      this.observed = new WeakSet();
    }
    for (const leaf of this.app.workspace.getLeavesOfType("file-explorer")) {
      const el = leaf.view && leaf.view.containerEl;
      if (el && !this.observed.has(el)) {
        this.observer.observe(el, { childList: true, subtree: true });
        this.observed.add(el);
      }
    }
  }

  scheduleApply() {
    if (this._raf) return;
    this._raf = requestAnimationFrame(() => {
      this._raf = 0;
      this.applyAll();
    });
  }

  applyAll() {
    for (const leaf of this.app.workspace.getLeavesOfType("file-explorer")) {
      const root = leaf.view && leaf.view.containerEl;
      if (!root) continue;
      root.querySelectorAll("[data-path]").forEach((el) => {
        const color = this.colors[el.getAttribute("data-path")];
        if (color) {
          if (el.style.getPropertyValue("--color-marker") !== color) {
            el.style.setProperty("--color-marker", color);
            el.style.setProperty("--color-marker-rgb", hexToRgb(color));
          }
          el.classList.add(MARK_CLASS);
        } else if (el.classList.contains(MARK_CLASS)) {
          el.classList.remove(MARK_CLASS);
          el.style.removeProperty("--color-marker");
          el.style.removeProperty("--color-marker-rgb");
        }
      });
    }
  }
}

// Fallback picker for environments without submenu support.
class ColorPickerModal extends obsidian.Modal {
  constructor(app, plugin, file) {
    super(app);
    this.plugin = plugin;
    this.file = file;
  }

  onOpen() {
    this.titleEl.setText("Color marker");
    const grid = this.contentEl.createDiv({ cls: "color-marker-grid" });
    for (const c of COLORS) {
      const cell = grid.createEl("button", {
        cls: "color-marker-cell",
        attr: { "aria-label": c.name, title: c.name },
      });
      cell.style.backgroundColor = c.value;
      cell.onclick = () => {
        this.plugin.setColor(this.file.path, c.value);
        this.close();
      };
    }
    const remove = this.contentEl.createEl("button", {
      cls: "color-marker-remove",
      text: "Remove color",
    });
    remove.onclick = () => {
      this.plugin.setColor(this.file.path, null);
      this.close();
    };
  }

  onClose() {
    this.contentEl.empty();
  }
}

module.exports = ColorMarkerPlugin;
