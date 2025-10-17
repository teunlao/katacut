import type { ClaudeScope, ClaudeServerJson } from "@katacut/adapter-client-claude";
import { toClaudeServerJson } from "@katacut/adapter-client-claude";
import type { KatacutConfig, McpServerConfig } from "@katacut/schema";
import { stableStringify } from "@katacut/utils";

export type InstallActionKind = "add" | "update" | "remove" | "skip" | "apply";
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
	currentKnown: boolean,
): InstallAction[] {
	const plan: InstallAction[] = [];
	for (const [name, d] of Object.entries(desired)) {
		if (!currentKnown) {
			plan.push({ action: "apply", name, json: d });
			continue;
		}
		const c = current[name];
		if (!c) {
			plan.push({ action: "add", name, json: d });
			continue;
		}
		if (stableStringify(c) !== stableStringify(d)) plan.push({ action: "update", name, json: d });
		else plan.push({ action: "skip", name });
	}
	if (currentKnown && prune) for (const name of Object.keys(current)) if (!(name in desired)) plan.push({ action: "remove", name });
	return plan;
}

export function diffByNames(
  desired: Record<string, ClaudeServerJson>,
  currentNames: ReadonlySet<string>,
  prune: boolean,
): InstallAction[] {
  const plan: InstallAction[] = [];
  const desiredNames = new Set(Object.keys(desired));
  for (const [name, json] of Object.entries(desired)) {
    if (currentNames.has(name)) plan.push({ action: "update", name, json });
    else plan.push({ action: "add", name, json });
  }
  if (prune) for (const name of currentNames) if (!desiredNames.has(name)) plan.push({ action: "remove", name });
  return plan;
}

export type { ClaudeScope };
