import { readTextFile, execCapture } from "@katacut/utils";
import type { ClaudeScope, ClaudeServerJson } from "./types.js";

export async function ensureClaudeAvailable(): Promise<boolean> {
  const res = await execCapture("claude", ["--help"], {});
  return res.code === 0 || res.code === 2;
}

export async function listClaudeServers(scope: ClaudeScope, cwd = process.cwd()): Promise<Record<string, ClaudeServerJson>> {
  const attempt = await execCapture("claude", ["mcp", "list", "--scope", scope, "--json"], { cwd });
  if (attempt.code === 0) {
    try {
      const parsed = JSON.parse(attempt.stdout) as { mcpServers?: Record<string, ClaudeServerJson> } | Record<string, ClaudeServerJson>;
      if ("mcpServers" in parsed && parsed.mcpServers) return parsed.mcpServers as Record<string, ClaudeServerJson>;
      return parsed as Record<string, ClaudeServerJson>;
    } catch {
      // fall back below
    }
  }
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

export async function addOrUpdateClaudeServer(
  name: string,
  json: ClaudeServerJson,
  scope: ClaudeScope,
  cwd = process.cwd(),
): Promise<{ code: number; stderr: string }>
{
  const payload = JSON.stringify(json);
  const res = await execCapture("claude", ["mcp", "add-json", name, payload, "--scope", scope], { cwd });
  return { code: res.code, stderr: res.stderr };
}

export async function removeClaudeServer(name: string, scope: ClaudeScope, cwd = process.cwd()) {
  const res = await execCapture("claude", ["mcp", "remove", name, "--scope", scope], { cwd });
  return { code: res.code, stderr: res.stderr };
}

