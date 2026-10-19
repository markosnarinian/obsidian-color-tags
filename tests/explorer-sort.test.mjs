import assert from "node:assert/strict";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import { buildSync } from "esbuild";

// Obsidian supplies these classes at runtime; its npm package only has types.
class TFolder {
	constructor(path) { this.path = path; }
}
const module = { exports: {} };
const { outputFiles } = buildSync({
	entryPoints: ["src/explorer-sort.ts"], bundle: true, write: false,
	platform: "node", format: "cjs", external: ["obsidian"],
});
runInNewContext(outputFiles[0].text, {
	module, exports: module.exports,
	require: () => ({ TFolder }),
});
const { sortExplorerItems } = module.exports;
const file = (path) => ({ file: { path } });
const folder = (path) => ({ file: new TFolder(path) });
const paths = (items) => Array.from(items, (item) => item.file.path);

test("folders first, colors before untagged, native order within each color", () => {
	// Deliberately not alphabetical: this could be native modified-date order.
	const items = [folder("plain-folder"), folder("blue-folder"), folder("red-folder"),
		file("plain.md"), file("blue.md"), file("z-red.md"), file("a-red.md"), file("unknown.md")];
	const colors = {
		"blue-folder": "#0A7AFF", "red-folder": "#FF5257", "blue.md": "#0A7AFF",
		"z-red.md": "#FF5257", "a-red.md": "#FF5257", "unknown.md": "#123456",
	};
	const original = items.slice();
	const sorted = sortExplorerItems(items, colors);
	assert.deepEqual(paths(sorted), ["red-folder", "blue-folder", "plain-folder",
		"z-red.md", "a-red.md", "blue.md", "plain.md", "unknown.md"]);
	assert.deepEqual(items, original, "does not mutate the native list");
	assert.equal(new Set(sorted).size, items.length);
	for (const item of sorted) assert.ok(items.includes(item), "preserves explorer objects");
});

test("palette order is not hexadecimal or alphabetical order", () => {
	const colors = {
		red: "#FF5257", orange: "#FF9A34", yellow: "#FFC72C", green: "#64C947",
		blue: "#0A7AFF", purple: "#CC73E1", gray: "#59636E", teal: "#20BFA9",
		cyan: "#26BDEB", indigo: "#6476DC", black: "#000000", brown: "#A8754F",
	};
	const items = ["black", "cyan", "red", "indigo", "blue", "brown", "gray",
		"yellow", "teal", "green", "orange", "purple"].map(file);
	assert.deepEqual(paths(sortExplorerItems(items, colors)), ["red", "orange", "yellow",
		"green", "blue", "purple", "gray", "teal", "cyan", "indigo", "black", "brown"]);
});

test("empty and untagged folders retain native order", () => {
	assert.deepEqual(paths(sortExplorerItems([], {})), []);
	const items = [folder("Z"), folder("A"), file("z.md"), file("a.md")];
	assert.deepEqual(paths(sortExplorerItems(items, {})), ["Z", "A", "z.md", "a.md"]);
});
