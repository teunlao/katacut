import type { ApplyResultSummary, ClientAdapter, InstallStep, ReadMcpResult, Scope, ServerJson } from "@katacut/core";
import type { KatacutConfig, McpServerConfig } from "@katacut/schema";
import { addOrUpdateGeminiServer, ensureGeminiAvailable, removeGeminiServer } from "./cli.js";
import { readProjectGemini, readUserGemini } from "./files.js";
import { toGeminiServerJson } from "./map.js";

export const geminiCliAdapter: ClientAdapter = {
  id: "gemini-cli",
  capabilities() {
    return {
      supportsProject: true,
      supportsUser: true,
      emulateProjectWithUser: false,
      supportsGlobalExplicit: false,
    };
  },
  async readProject(cwd?: string): Promise<ReadMcpResult> {
    return readProjectGemini(cwd);
  },
  async readUser(): Promise<ReadMcpResult> {
    return readUserGemini();
  },
  desiredFromConfig(config: unknown): Record<string, ServerJson> {
    const out: Record<string, ServerJson> = {};
    const cfg = config as KatacutConfig;
    const src: Record<string, McpServerConfig> = (cfg.mcp ?? {}) as Record<string, McpServerConfig>;
    for (const name of Object.keys(src)) {
      const gj = toGeminiServerJson(src[name]);
      // normalize gemini json back to our ServerJson
      if (gj.type === "stdio") out[name] = { type: "stdio", command: gj.command, args: gj.args, env: gj.env };
      else out[name] = { type: "http", url: gj.httpUrl, headers: gj.headers };
    }
    return out;
  },
  async applyInstall(plan: readonly InstallStep[], scope: Scope, cwd?: string): Promise<ApplyResultSummary> {
    let added = 0;
    let updated = 0;
    let removed = 0;
    let failed = 0;
    for (const step of plan) {
      try {
        if (step.action === "remove") {
          const r = await removeGeminiServer(step.name, scope, cwd);
          if (r.code === 0) removed++;
          else failed++;
        } else {
          const json = step.json;
          if (!json) { failed++; continue; }
          const r = await addOrUpdateGeminiServer(step.name, json, scope, cwd);
          if (r.code === 0) {
            if (step.action === "add") added++; else updated++;
          } else failed++;
        }
      } catch {
        failed++;
      }
    }
    return { added, updated, removed, failed };
  },
  async checkAvailable() {
    return ensureGeminiAvailable();
  },
};

