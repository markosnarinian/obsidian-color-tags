import { TAbstractFile, TFolder } from "obsidian";
import { COLORS } from "./colors";

/** The existing explorer objects must survive sorting (selection, drag and drop). */
export interface ExplorerItem {
	file: TAbstractFile;
}

const colorRanks = new Map(COLORS.map((color, index) => [color.value, index]));

/** Stable buckets preserve the native sort within each color without mutating it. */
export function sortExplorerItems(items: ExplorerItem[], colors: Record<string, string>): ExplorerItem[] {
	const bucketCount = COLORS.length + 1;
	const buckets: ExplorerItem[][] = Array.from({ length: bucketCount * 2 }, () => []);
	for (const item of items) {
		const rank = colorRanks.get(colors[item.file.path]) ?? COLORS.length;
		const offset = item.file instanceof TFolder ? 0 : bucketCount;
		buckets[offset + rank].push(item);
	}
	return ([] as ExplorerItem[]).concat(...buckets);
}
