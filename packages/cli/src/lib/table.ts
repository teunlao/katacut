export function renderTable(headers: readonly string[], rows: readonly (readonly string[])[]) {
	const widths = headers.map((h, i) => Math.max(h.length, ...rows.map((r) => (r[i] ?? "").length)));
	const line = (cols: readonly string[]) => cols.map((c, i) => c.padEnd(widths[i], " ")).join("  |  ");
	console.log(line(headers));
	console.log(widths.map((w) => "".padEnd(w, "-")).join("--+--"));
	for (const r of rows) console.log(line(r));
}
