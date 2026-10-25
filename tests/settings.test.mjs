import assert from "node:assert/strict";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import { buildSync } from "esbuild";

class Plugin {
	async loadData() { return this.data; }
	async saveData(data) { this.data = JSON.parse(JSON.stringify(data)); }
	addCommand(command) { this.command = command; }
	addSettingTab() {}
	register() {}
	registerEvent() {}
}
class TFolder {}
const module = { exports: {} };
const { outputFiles } = buildSync({
	entryPoints: ["src/main.ts"], bundle: true, write: false,
	platform: "node", format: "cjs", external: ["obsidian"],
});
runInNewContext(outputFiles[0].text, {
	module, exports: module.exports,
	require: () => ({ Plugin, TFolder, PluginSettingTab: class {}, Modal: class {} }),
	MutationObserver: class { observe() {} },
});
const ColorTagsPlugin = module.exports.default;

async function load(data) {
	const items = ["blue.md", "red.md"].map((path) => ({ file: { path } }));
	class Explorer {
		containerEl = { querySelector: () => null, querySelectorAll: () => [] };
		getSortedFolderItems() { return items; }
		requestSort() {}
	}
	const view = new Explorer();
	const nativeSorter = view.getSortedFolderItems;
	const events = new Map();
	const plugin = new ColorTagsPlugin();
	plugin.data = data;
	plugin.app = {
		workspace: {
			getLeavesOfType: () => [{ view }],
			onLayoutReady: () => {},
			on: (name, callback) => events.set(name, callback),
		},
		vault: { on: () => {} },
	};
	await plugin.onload();
	const layoutChange = () => events.get("layout-change")();
	layoutChange();
	return { plugin, view, nativeSorter, layoutChange };
}

test("disabling removes sorting, blocks the command, persists, and survives explorer updates", async () => {
	// Existing 1.1.0 data has no integration setting: preserve its active sort.
	const { plugin, view, nativeSorter, layoutChange } = await load({
		paths: { "blue.md": "#0A7AFF", "red.md": "#FF5257" }, sortByColor: true,
	});
	const paths = () => Array.from(view.getSortedFolderItems(), (item) => item.file.path);
	assert.deepEqual(paths(), ["red.md", "blue.md"]);
	await plugin.setColorSortingEnabled(false);
	assert.deepEqual(paths(), ["blue.md", "red.md"]);
	assert.equal(view.getSortedFolderItems, nativeSorter, "native sorting method is restored");
	assert.equal(plugin.command.checkCallback(false), false, "command cannot reactivate sorting");
	await plugin.setColor("blue.md", "#64C947");
	layoutChange();
	assert.equal(view.getSortedFolderItems, nativeSorter, "repainting/layout changes do not reinstall sorting");
	assert.deepEqual(plugin.data, {
		paths: { "blue.md": "#64C947", "red.md": "#FF5257" },
		sortByColor: false, colorSortingEnabled: false,
	});
	const restarted = await load(plugin.data);
	assert.equal(restarted.view.getSortedFolderItems, restarted.nativeSorter);
	assert.equal(restarted.plugin.command.checkCallback(true), false);
	await restarted.plugin.setColorSortingEnabled(true);
	assert.equal(restarted.plugin.command.checkCallback(true), true);
	assert.deepEqual(Array.from(restarted.view.getSortedFolderItems(), (item) => item.file.path), ["blue.md", "red.md"], "re-enabling starts with normal sorting");
	assert.equal(restarted.plugin.data.colorSortingEnabled, true);
	plugin.onunload();
	restarted.plugin.onunload();
});

test("external data.json changes reload colors and sorting", async () => {
	const { plugin, view, nativeSorter } = await load({
		paths: { "blue.md": "#0A7AFF", "red.md": "#FF5257" }, sortByColor: true,
	});
	assert.notEqual(view.getSortedFolderItems, nativeSorter);
	plugin.data = {
		paths: { "blue.md": "#64C947" }, sortByColor: true, colorSortingEnabled: false,
	};
	await plugin.onExternalSettingsChange();
	assert.equal(view.getSortedFolderItems, nativeSorter, "external settings disable color sorting");
	assert.equal(plugin.command.checkCallback(true), false);
	plugin.onunload();
});
