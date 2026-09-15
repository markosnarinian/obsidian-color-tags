/*
 * Color Tags — an Obsidian plugin.
 * Copyright (c) 2026 Markos Narinian. MIT licensed; see LICENSE.
 *
 * Derived from Color Marker by Central Brain Trust (MIT):
 * https://github.com/ruisloan/obsidian-color-marker
 * Copyright (c) 2026 Central Brain Trust
 */

import { App, Menu, MenuItem, Modal, Plugin, TAbstractFile, WorkspaceLeaf } from "obsidian";
import { COLORS, hexToRgb } from "./colors";

const MARK_CLASS = "color-tags-item";

/**
 * Obsidian paints file explorer rows from these custom properties, so setting
 * them inline on a row recolors its resting, hover, active and selected states
 * while leaving the theme's own radius, padding and sizing completely alone.
 * That is what keeps the hover overlay's shape identical to an untagged row.
 *
 * `--color-tag-rgb` is ours; styles.css uses it for the resting tint.
 */
const TAG_VARS = [
	"--nav-item-color",
	"--nav-item-color-hover",
	"--nav-item-color-active",
	"--nav-item-color-selected",
	"--nav-collapse-icon-color",
	"--nav-collapse-icon-color-collapsed",
	"--nav-item-background-hover",
	"--nav-item-background-active",
	"--nav-item-background-selected",
	"--color-tag-rgb",
] as const;

interface ColorTagsData {
	paths?: Record<string, string>;
}

export default class ColorTagsPlugin extends Plugin {
	private colors: Record<string, string> = {};
	private observer: MutationObserver | null = null;
	private observed = new WeakSet<HTMLElement>();
	private frame = 0;

	async onload() {
		const data = (await this.loadData()) as ColorTagsData | null;
		this.colors = data?.paths ?? {};

		// "Color tag" entry in the right-click menu of files and folders.
		this.registerEvent(
			this.app.workspace.on("file-menu", (menu, file) => {
				menu.addItem((item) => {
					item.setTitle("Color tag").setIcon("palette");
					const withSubmenu = item as MenuItem & { setSubmenu?: () => Menu };
					if (typeof withSubmenu.setSubmenu === "function") {
						// Desktop: a proper submenu of swatches.
						this.buildColorMenu(withSubmenu.setSubmenu(), file);
					} else {
						// Older builds and mobile: fall back to a swatch dialog.
						item.onClick(() => new ColorPickerModal(this.app, this, file).open());
					}
				});
			})
		);

		// Keep tags attached to items when they are renamed or moved.
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
				if (changed) void this.saveColors().then(() => this.applyAll());
			})
		);

		// Drop tags of deleted items.
		this.registerEvent(
			this.app.vault.on("delete", (file) => {
				if (this.colors[file.path]) {
					delete this.colors[file.path];
					void this.saveColors();
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
		for (const leaf of this.explorerLeaves()) {
			leaf.querySelectorAll<HTMLElement>("." + MARK_CLASS).forEach((el) => this.clear(el));
		}
	}

	/** Container elements of every open file explorer view. */
	private explorerLeaves(): HTMLElement[] {
		const roots: HTMLElement[] = [];
		for (const leaf of this.app.workspace.getLeavesOfType("file-explorer")) {
			const el = (leaf as WorkspaceLeaf & { view?: { containerEl?: HTMLElement } }).view
				?.containerEl;
			if (el) roots.push(el);
		}
		return roots;
	}

	/** Builds the swatch list inside a Menu (used by the submenu). */
	private buildColorMenu(menu: Menu, file: TAbstractFile) {
		const current = this.colors[file.path];
		for (const c of COLORS) {
			menu.addItem((item) => {
				item.setTitle(c.emoji + " " + c.name).onClick(() => void this.setColor(file.path, c.value));
				if (typeof item.setChecked === "function") item.setChecked(current === c.value);
			});
		}
		menu.addSeparator();
		menu.addItem((item) =>
			item
				.setTitle("Remove color")
				.setIcon("x")
				.setDisabled(!current)
				.onClick(() => void this.setColor(file.path, null))
		);
	}

	async setColor(path: string, color: string | null) {
		if (color) this.colors[path] = color;
		else delete this.colors[path];
		await this.saveColors();
		this.applyAll();
	}

	private saveColors() {
		return this.saveData({ paths: this.colors });
	}

	/** Re-applies tags whenever the file explorer re-renders its tree. */
	private watchExplorers() {
		if (!this.observer) {
			this.observer = new MutationObserver(() => this.scheduleApply());
			this.register(() => this.observer?.disconnect());
		}
		for (const el of this.explorerLeaves()) {
			if (!this.observed.has(el)) {
				this.observer.observe(el, { childList: true, subtree: true });
				this.observed.add(el);
			}
		}
	}

	private scheduleApply() {
		if (this.frame) return;
		this.frame = requestAnimationFrame(() => {
			this.frame = 0;
			this.applyAll();
		});
	}

	private applyAll() {
		for (const root of this.explorerLeaves()) {
			root.querySelectorAll<HTMLElement>("[data-path]").forEach((el) => {
				const color = this.colors[el.getAttribute("data-path") ?? ""];
				if (color) this.paint(el, color);
				else if (el.classList.contains(MARK_CLASS)) this.clear(el);
			});
		}
	}

	private paint(el: HTMLElement, color: string) {
		if (el.style.getPropertyValue("--nav-item-color") !== color) {
			const rgb = hexToRgb(color);
			el.style.setProperty("--nav-item-color", color);
			el.style.setProperty("--nav-item-color-hover", color);
			el.style.setProperty("--nav-item-color-active", color);
			el.style.setProperty("--nav-item-color-selected", color);
			el.style.setProperty("--nav-collapse-icon-color", color);
			el.style.setProperty("--nav-collapse-icon-color-collapsed", color);
			el.style.setProperty("--nav-item-background-hover", `rgba(${rgb}, 0.18)`);
			el.style.setProperty("--nav-item-background-active", `rgba(${rgb}, 0.24)`);
			el.style.setProperty("--nav-item-background-selected", `rgba(${rgb}, 0.24)`);
			el.style.setProperty("--color-tag-rgb", rgb);
		}
		el.classList.add(MARK_CLASS);
	}

	private clear(el: HTMLElement) {
		el.classList.remove(MARK_CLASS);
		for (const name of TAG_VARS) el.style.removeProperty(name);
	}
}

/** Fallback picker for environments without submenu support. */
class ColorPickerModal extends Modal {
	constructor(
		app: App,
		private plugin: ColorTagsPlugin,
		private file: TAbstractFile
	) {
		super(app);
	}

	onOpen() {
		this.titleEl.setText("Color tag");
		const grid = this.contentEl.createDiv({ cls: "color-tags-grid" });
		for (const c of COLORS) {
			const cell = grid.createEl("button", {
				cls: "color-tags-cell",
				attr: { "aria-label": c.name, title: c.name },
			});
			cell.style.backgroundColor = c.value;
			cell.onclick = () => {
				void this.plugin.setColor(this.file.path, c.value);
				this.close();
			};
		}
		const remove = this.contentEl.createEl("button", {
			cls: "color-tags-remove",
			text: "Remove color",
		});
		remove.onclick = () => {
			void this.plugin.setColor(this.file.path, null);
			this.close();
		};
	}

	onClose() {
		this.contentEl.empty();
	}
}
