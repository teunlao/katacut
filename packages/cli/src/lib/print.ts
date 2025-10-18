import type { ResolvedFormat } from "./format.js";
import { renderTable } from "./table.js";

export function printTableSection(title: string, headers: readonly string[], rows: readonly (readonly string[])[], fmt: ResolvedFormat) {
  if (fmt.json || fmt.noSummary) return;
  console.log(`${title}:`);
  renderTable(headers, rows);
}

