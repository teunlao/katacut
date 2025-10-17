import type { ClaudeScope, ClaudeServerJson } from "@katacut/adapter-client-claude";
import { toClaudeServerJson } from "@katacut/adapter-client-claude";
import type { KatacutConfig, McpServerConfig } from "@katacut/schema";
import { stableStringify } from "@katacut/utils";

export type InstallActionKind = "add" | "update" | "remove" | "skip";
export interface InstallAction {
	readonly action: InstallActionKind;
	readonly name: string;
	readonly json?: ClaudeServerJson;
}

export function desiredFromConfig(config: KatacutConfig): Record<string, ClaudeServerJson> {
	const out: Record<string, ClaudeServerJson> = {};
	const src = config.mcp ?? {};
	for (const [name, server] of Object.entries(src)) out[name] = toClaudeServerJson(server as McpServerConfig);
	return out;
}

export function diffDesiredCurrent(
	desired: Record<string, ClaudeServerJson>,
	current: Record<string, ClaudeServerJson>,
	prune: boolean,
): InstallAction[] {
	const plan: InstallAction[] = [];
	for (const [name, d] of Object.entries(desired)) {
		const c = current[name];
		if (!c) {
			plan.push({ action: "add", name, json: d });
			continue;
		}
		if (stableStringify(c) !== stableStringify(d)) plan.push({ action: "update", name, json: d });
		else plan.push({ action: "skip", name });
	}
	if (prune) for (const name of Object.keys(current)) if (!(name in desired)) plan.push({ action: "remove", name });
	return plan;
}

export type { ClaudeScope };
