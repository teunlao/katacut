import type { ServerJson } from "../ports/adapters.js";

export type ActionKind = "add" | "update" | "remove" | "skip";
export interface Action {
	readonly action: ActionKind;
	readonly name: string;
	readonly json?: ServerJson;
}

export function diffDesiredCurrent(
	desired: Record<string, ServerJson>,
	current: Record<string, ServerJson>,
	prune: boolean,
	_currentKnown: boolean,
): Action[] {
	const plan: Action[] = [];
	for (const [name, d] of Object.entries(desired)) {
		const c = current[name];
		if (!c) {
			plan.push({ action: "add", name, json: d });
			continue;
		}
		if (JSON.stringify(c) !== JSON.stringify(d)) plan.push({ action: "update", name, json: d });
		else plan.push({ action: "skip", name });
	}
	if (prune) for (const name of Object.keys(current)) if (!(name in desired)) plan.push({ action: "remove", name });
	return plan;
}

export function diffByNames(
	desired: Record<string, ServerJson>,
	currentNames: ReadonlySet<string>,
	prune: boolean,
): Action[] {
	const plan: Action[] = [];
	const desiredNames = new Set(Object.keys(desired));
	for (const [name, json] of Object.entries(desired)) {
		if (currentNames.has(name)) plan.push({ action: "update", name, json });
		else plan.push({ action: "add", name, json });
	}
	if (prune) for (const name of currentNames) if (!desiredNames.has(name)) plan.push({ action: "remove", name });
	return plan;
}
