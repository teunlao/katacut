import type { ResolvedFormat } from './format.js';
import { renderTable } from './table.js';

export function printTableSection(
	title: string,
	headers: readonly string[],
	rows: readonly (readonly string[])[],
	fmt: ResolvedFormat,
) {
	if (fmt.json || fmt.noSummary) return;
	console.log(`${title}:`);
	renderTable(headers, rows);
}

export interface SummaryCounts {
	readonly added: number;
	readonly updated: number;
	readonly removed: number;
	readonly failed: number;
}

export function buildSummaryLine(summary: SummaryCounts, skipped: number): string {
	return `Summary: added=${summary.added} updated=${summary.updated} removed=${summary.removed} skipped=${skipped} failed=${summary.failed}`;
}
