import { homedir } from "node:os";
import { join } from "node:path";

import { readTextFile } from "@katacut/utils";

import type { ClaudeServerJson } from "./types.js";

export interface ReadMcpResult {
  readonly source?: string;
  readonly mcpServers: Record<string, ClaudeServerJson>;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function extractMcpServers(value: unknown): Record<string, ClaudeServerJson> | undefined {
  if (!isObject(value)) return undefined;
  if (isObject((value as Record<string, unknown>).mcpServers)) {
    const obj = (value as Record<string, unknown>).mcpServers as Record<string, unknown>;
    const out: Record<string, ClaudeServerJson> = {};
    for (const [k, v] of Object.entries(obj)) {
      if (!isObject(v)) continue;
      const vv = v as Record<string, unknown>;
      const type = vv.type === "http" || vv.type === "stdio" ? vv.type : undefined;
      if (!type) continue;
      if (type === "http") {
        const url = typeof vv.url === "string" ? vv.url : undefined;
        if (!url) continue;
        const headers = isObject(vv.headers)
          ? Object.fromEntries(Object.entries(vv.headers).filter(([, val]) => typeof val === "string") as [string, string][]) : undefined;
        out[k] = { type: "http", url, headers };
      } else {
        const command = typeof vv.command === "string" ? vv.command : undefined;
        if (!command) continue;
        const args = Array.isArray(vv.args) ? (vv.args.filter((a) => typeof a === "string") as string[]) : undefined;
        const env = isObject(vv.env)
          ? Object.fromEntries(Object.entries(vv.env).filter(([, val]) => typeof val === "string") as [string, string][]) : undefined;
        out[k] = { type: "stdio", command, args, env };
      }
    }
    return out;
  }
  // recursive search
  for (const val of Object.values(value)) {
    const found = extractMcpServers(val);
    if (found) return found;
  }
  return undefined;
}

async function readJson(path: string): Promise<unknown | undefined> {
  try { return JSON.parse(await readTextFile(path)); } catch { return undefined; }
}

export async function readProjectMcp(cwd = process.cwd()): Promise<ReadMcpResult> {
  const path = join(cwd, ".mcp.json");
  const parsed = await readJson(path);
  const servers = extractMcpServers(parsed) ?? {};
  return { source: servers && Object.keys(servers).length > 0 ? path : undefined, mcpServers: servers };
}

export async function readUserMcp(): Promise<ReadMcpResult> {
  const home = homedir();
  const xdg = process.env.XDG_CONFIG_HOME ? join(process.env.XDG_CONFIG_HOME, "claude") : join(home, ".config", "claude");
  const candidates: string[] = [
    // POSIX-style locations (macOS/Linux)
    join(home, ".claude", "settings.json"),
    join(home, ".claude.json"),
    join(xdg, "settings.json"),
    join(xdg, "config.json"),
  ];
  // Windows-style locations (additionally checked on all platforms; existence decides)
  if (process.env.USERPROFILE) {
    candidates.push(join(process.env.USERPROFILE, ".claude", "settings.json"));
    candidates.push(join(process.env.USERPROFILE, ".claude.json"));
  }
  if (process.env.APPDATA) {
    candidates.push(join(process.env.APPDATA, "Claude", "settings.json"));
  }
  for (const file of candidates) {
    const parsed = await readJson(file);
    const servers = extractMcpServers(parsed);
    if (servers && Object.keys(servers).length > 0) return { source: file, mcpServers: servers };
  }
  return { mcpServers: {} };
}
