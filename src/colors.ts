/**
 * The seven macOS Finder tag colors, in Finder's own order.
 *
 * The emoji is a fallback swatch: when Obsidian is set to use native OS menus,
 * the menu can only render text, so the emoji stands in for a color chip.
 */
export interface TagColor {
	name: string;
	value: string;
	emoji: string;
}

export const COLORS: TagColor[] = [
	{ name: "Red", value: "#FF5257", emoji: "🔴" },
	{ name: "Orange", value: "#FF9A34", emoji: "🟠" },
	{ name: "Yellow", value: "#FFC72C", emoji: "🟡" },
	{ name: "Green", value: "#64C947", emoji: "🟢" },
	{ name: "Blue", value: "#0A7AFF", emoji: "🔵" },
	{ name: "Purple", value: "#CC73E1", emoji: "🟣" },
	{ name: "Gray", value: "#A6A6A6", emoji: "⚪" },
];

/** "#FF5257" -> "255,82,87", the form rgba() needs in the stylesheet. */
export function hexToRgb(hex: string): string {
	const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
	if (!m) return "128,128,128";
	return [m[1], m[2], m[3]].map((p) => parseInt(p, 16)).join(",");
}
