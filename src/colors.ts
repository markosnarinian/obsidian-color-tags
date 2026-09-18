/*
 * Color Tags — an Obsidian plugin.
 * Copyright (c) 2026 Markos Narinian. MIT licensed; see LICENSE.
 *
 * Derived from Color Marker by Central Brain Trust (MIT):
 * https://github.com/ruisloan/obsidian-color-marker
 * Copyright (c) 2026 Central Brain Trust
 */

/** The macOS Finder tag colors, followed by additional vibrant tag colors. */
export interface TagColor {
	name: string;
	value: string;
	/** Matching Unicode circle emoji, when one exists for this color. */
	emoji?: string;
}

export const COLORS: TagColor[] = [
	{ name: "Red", value: "#FF5257", emoji: "🔴" },
	{ name: "Orange", value: "#FF9A34", emoji: "🟠" },
	{ name: "Yellow", value: "#FFC72C", emoji: "🟡" },
	{ name: "Green", value: "#64C947", emoji: "🟢" },
	{ name: "Blue", value: "#0A7AFF", emoji: "🔵" },
	{ name: "Purple", value: "#CC73E1", emoji: "🟣" },
	{ name: "Gray", value: "#A6A6A6", emoji: "⚪" },
	{ name: "Teal", value: "#20BFA9" },
	{ name: "Cyan", value: "#26BDEB" },
	{ name: "Indigo", value: "#6476DC" },
	{ name: "Black", value: "#59636E", emoji: "⚫" },
	{ name: "Brown", value: "#A8754F", emoji: "🟤" },
];

/** "#FF5257" -> "255,82,87", the form rgba() needs in the stylesheet. */
export function hexToRgb(hex: string): string {
	const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
	if (!m) return "128,128,128";
	return [m[1], m[2], m[3]].map((p) => parseInt(p, 16)).join(",");
}
