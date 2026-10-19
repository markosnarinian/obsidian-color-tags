/*
 * Color Tags — an Obsidian plugin.
 * Copyright (c) 2026 Markos Narinian. MIT licensed; see LICENSE.
 *
 * Derived from Color Marker by Central Brain Trust (MIT):
 * https://github.com/ruisloan/obsidian-color-marker
 * Copyright (c) 2026 Central Brain Trust
 */

import { App, Menu, MenuItem, Modal, Notice, Plugin, setIcon, TAbstractFile, TFolder, View, WorkspaceLeaf } from "obsidian";
import { around } from "monkey-around";
import { COLORS, hexToRgb } from "./colors";
import { ExplorerItem, sortExplorerItems } from "./explorer-sort";

const MARK_CLASS = "color-tags-item";
const BLACK_CLASS = "color-tags-black";
const BLACK = "#000000";

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
	sortByColor?: boolean;
}

/** Private Obsidian API: capability-checked before installing the wrapper. */
interface SortableExplorer {
	getSortedFolderItems(folder: TFolder): ExplorerItem[];
	requestSort(): void;
}

export default class ColorTagsPlugin extends Plugin {
	private colors: Record<string, string> = {};
	private sortByColor = false;
	private sortPatches = new Map<SortableExplorer, () => void>();
	private unloaded = false;
	private sortWarningShown = false;
	private observer: MutationObserver | null = null;
	private observed = new WeakSet<HTMLElement>();
	private frame = 0;

	async onload() {
		const data = (await this.loadData()) as ColorTagsData | null;
		this.colors = data?.paths ?? {};
		this.sortByColor = data?.sortByColor === true;
		this.addCommand({
			id: "toggle-sort-by-color",
			name: "Toggle sort by color",
			callback: () => void this.toggleColorSort(),
		});

		// "Color tag" entry in the right-click menu of files and folders.
		this.registerEvent(
			this.app.workspace.on("file-menu", (menu, file) => {
				menu.addItem((item) => {
					item.setTitle("Color tag");
					const withSubmenu = item as MenuItem & { setSubmenu?: () => Menu };
					if (typeof withSubmenu.setSubmenu === "function") {
						// Desktop: a proper submenu of color names.
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
				if (changed) void this.saveColors().then(() => {
					this.applyAll();
					if (this.sortByColor) this.requestSort();
				});
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

		// A frame queued as the plugin unloads would repaint rows that onunload
		// has already cleared, so drop it.
		this.register(() => {
			if (this.frame) window.cancelAnimationFrame(this.frame);
			this.frame = 0;
		});

		// Paint the explorer now and whenever it re-renders.
		this.app.workspace.onLayoutReady(() => {
			if (this.unloaded) return;
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
		this.unloaded = true;
		for (const uninstall of this.sortPatches.values()) uninstall();
		this.sortPatches.clear();
		this.requestSort();
		for (const leaf of this.explorerLeaves()) {
			leaf.querySelector(".color-tags-sort-button")?.remove();
			leaf.querySelectorAll<HTMLElement>("." + MARK_CLASS).forEach((el) => this.clear(el));
		}
	}

	private requestSort() {
		for (const leaf of this.app.workspace.getLeavesOfType("file-explorer")) {
			const view = leaf.view as View & Partial<SortableExplorer>;
			if (typeof view.requestSort === "function") view.requestSort();
		}
	}

	private async toggleColorSort() {
		const leaves = this.app.workspace.getLeavesOfType("file-explorer");
		if (!this.sortByColor && leaves.length && !leaves.some((leaf) => {
			const view = leaf.view as View & Partial<SortableExplorer>;
			return typeof view.getSortedFolderItems === "function" && typeof view.requestSort === "function";
		})) {
			new Notice("Color sorting is unavailable. Open the file explorer and try again; this Obsidian version may not support it.");
			return;
		}
		this.sortByColor = !this.sortByColor;
		this.applyAll();
		this.requestSort();
		await this.saveColors();
	}

	/** Patch each explorer prototype once; add one control to each loaded view. */
	private syncColorSort() {
		for (const leaf of this.app.workspace.getLeavesOfType("file-explorer")) {
			const view = leaf.view as View & Partial<SortableExplorer>;
			const supported = typeof view.getSortedFolderItems === "function" && typeof view.requestSort === "function";
			if (supported) {
				const prototype = Object.getPrototypeOf(view) as SortableExplorer;
				if (!this.sortPatches.has(prototype)) {
					const plugin = this;
					this.sortPatches.set(prototype, around(prototype, {
						getSortedFolderItems(original) {
							return function (this: SortableExplorer, folder) {
								const items = original.call(this, folder);
								if (!plugin.sortByColor || plugin.unloaded) return items;
								// A changed private API must not break the explorer.
								if (!Array.isArray(items) || items.some((item) => typeof item?.file?.path !== "string")) {
									if (!plugin.sortWarningShown) {
										plugin.sortWarningShown = true;
										new Notice("Color sorting is unavailable in this Obsidian version. Normal sorting has been preserved.");
									}
									return items;
								}
								return sortExplorerItems(items, plugin.colors);
							};
						},
					}));
				}
			}
			const toolbar = view.containerEl.querySelector<HTMLElement>(".nav-buttons-container");
			if (!toolbar) continue;
			let button = toolbar.querySelector<HTMLButtonElement>(".color-tags-sort-button");
			if (!button) {
				button = toolbar.createEl("button", {
					cls: "clickable-icon nav-action-button color-tags-sort-button",
					attr: { type: "button", "aria-label": "Sort by color" },
				});
				setIcon(button, "palette");
				this.registerDomEvent(button, "click", () => void this.toggleColorSort());
				// Newly materialized views may have sorted before the patch was installed.
				if (supported && this.sortByColor) view.requestSort?.();
			}
			button.disabled = !supported;
			button.setAttribute("aria-pressed", String(supported && this.sortByColor));
			button.classList.toggle("is-active", supported && this.sortByColor);
			button.setAttribute("aria-label", supported ? "Sort by color" : "Color sorting unavailable in this Obsidian version");
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
				item
					.setTitle(c.emoji ? `${c.emoji} ${c.name}` : c.name)
					.onClick(() => void this.setColor(file.path, c.value));
				if (typeof item.setChecked === "function") item.setChecked(current === c.value);
			});
		}
		menu.addSeparator();
		menu.addItem((item) =>
			item
				.setTitle("Remove color")
				.setDisabled(!current)
				.onClick(() => void this.setColor(file.path, null))
		);
	}

	async setColor(path: string, color: string | null) {
		if (color) this.colors[path] = color;
		else delete this.colors[path];
		await this.saveColors();
		this.applyAll();
		if (this.sortByColor) this.requestSort();
	}

	private saveColors() {
		return this.saveData({ paths: this.colors, sortByColor: this.sortByColor });
	}

	/** Re-applies tags whenever the file explorer re-renders its tree. */
	private watchExplorers() {
		if (!this.observer) {
			this.observer = new MutationObserver(() => this.scheduleApply());
			this.register(() => this.observer?.disconnect());
		}
		for (const el of this.explorerLeaves()) {
			// Observe the parent too: a deferred view's container can be replaced.
			const host = el.parentElement ?? el;
			if (!this.observed.has(host)) {
				this.observer.observe(host, { childList: true, subtree: true });
				this.observed.add(host);
			}
		}
	}

	private scheduleApply() {
		if (this.frame) return;
		// window-qualified so this resolves against the right window in popouts.
		this.frame = window.requestAnimationFrame(() => {
			this.frame = 0;
			this.applyAll();
		});
	}

	private applyAll() {
		if (this.unloaded) return;
		this.syncColorSort();
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
		el.classList.toggle(BLACK_CLASS, color === BLACK);
	}

	private clear(el: HTMLElement) {
		el.classList.remove(MARK_CLASS, BLACK_CLASS);
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
