// Shared helpers for output formatting flags.
// Never use `any` here; keep types precise.

export interface FormatOptions {
	readonly json?: boolean;
	readonly noSummary?: boolean;
}

export interface ResolvedFormat {
	readonly json: boolean;
	readonly noSummary: boolean;
}

/**
 * Resolves formatting flags robustly, even if the caller
 * mistakenly passed options after an argument terminator (`--`).
 * We additionally inspect raw argv for presence of flags.
 */
export function resolveFormatFlags(argv: readonly string[], opts: FormatOptions): ResolvedFormat {
	const rawHas = (flag: string) => argv.includes(flag);
	const json = Boolean(opts.json) || rawHas("--json");
	const noSummary = Boolean(opts.noSummary) || rawHas("--no-summary");
	return { json, noSummary };
}
