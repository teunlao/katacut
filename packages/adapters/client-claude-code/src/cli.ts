import { execCapture, readTextFile } from "@katacut/utils";
import type { ClaudeScope, ClaudeServerJson } from "./types.js";

export async function ensureClaudeAvailable(): Promise<boolean> {
	const res = await execCapture("claude", ["--help"], {});
	return res.code === 0 || res.code === 2;
}

export async function listClaudeServers(
	scope: ClaudeScope,
	cwd = process.cwd(),
): Promise<Record<string, ClaudeServerJson>> {
	// У установленной версии Claude CLI нет стабильного JSON-вывода для list.
	// Для project-scope читаем файл .mcp.json. Для user-scope возвращаем пусто (состояние неизвестно).
	if (scope === "project") {
		try {
			const text = await readTextFile(".mcp.json", { cwd });
			const parsed = JSON.parse(text) as { mcpServers?: Record<string, ClaudeServerJson> };
			return parsed.mcpServers ?? {};
		} catch {
			// not present
		}
	}
	return {};
}

export async function listClaudeServerNames(cwd = process.cwd()): Promise<Set<string>> {
	const res = await execCapture("claude", ["mcp", "list"], { cwd });
	const names = new Set<string>();
	if (res.code !== 0) return names;
	const lines = res.stdout.split(/\r?\n/);
	for (const line of lines) {
		// Format example: "github: https://... (HTTP) - \u2717 Failed" or "fs: npx ... - \u2713 Connected"
		const m = line.match(/^\s*([A-Za-z0-9_.-]+):\s/);
		if (m) names.add(m[1]);
	}
	return names;
}

export async function addOrUpdateClaudeServer(
	name: string,
	json: ClaudeServerJson,
	scope: ClaudeScope,
	cwd = process.cwd(),
): Promise<{ code: number; stderr: string }> {
	const payload = JSON.stringify(json);
	const res = await execCapture("claude", ["mcp", "add-json", name, payload, "--scope", scope], { cwd });
	return { code: res.code, stderr: res.stderr };
}

export async function removeClaudeServer(name: string, scope: ClaudeScope, cwd = process.cwd()) {
	const res = await execCapture("claude", ["mcp", "remove", name, "--scope", scope], { cwd });
	return { code: res.code, stderr: res.stderr };
}
