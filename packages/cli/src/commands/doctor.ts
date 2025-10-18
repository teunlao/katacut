import { constants } from "node:fs";
import { access } from "node:fs/promises";
import { join } from "node:path";

import type { Command } from "commander";
import { getAdapter } from "../lib/adapters/registry.js";
import { resolveFormatFlags } from "../lib/format.js";
import { readProjectState } from "../lib/state.js";

interface PathCheck { readonly path: string; readonly readable?: boolean; readonly writable?: boolean }

interface DoctorReport {
  readonly client: string;
  readonly cli?: { readonly available: boolean };
  readonly project?: { readonly path: string; readonly readable?: boolean; readonly writable?: boolean };
  readonly user?: { readonly path?: string; readonly readable?: boolean; readonly writable?: boolean };
  readonly conflicts?: readonly string[];
  readonly capabilities?: {
    readonly supportsProject: boolean;
    readonly supportsUser: boolean;
    readonly emulateProjectWithUser: boolean;
    readonly supportsGlobalExplicit: boolean;
  };
  readonly realized?: {
    readonly at: string;
    readonly requestedScope: "project" | "user";
    readonly realizedScope: "project" | "user";
    readonly mode: "native" | "emulated";
  };
  readonly localOverrides?: ReadonlyArray<{ name: string; scope: "project"|"user"; action: "add"|"update"|"remove"|"skip" }>; 
  readonly status: "ok" | "warn" | "error";
}

async function checkPath(path: string): Promise<PathCheck> {
  let readable = false;
  let writable = false;
  try { await access(path, constants.R_OK); readable = true; } catch { readable = false; }
  try { await access(path, constants.W_OK); writable = true; } catch { writable = false; }
  return { path, readable, writable };
}

export function registerDoctorCommand(program: Command) {
  program
    .command("doctor")
    .description("Environment diagnostics for the selected client")
    .option("--client <id>", "Client id (default: claude-code)")
    .option("--json", "machine-readable output: only JSON report (no summary)")
    .option("--no-summary", "suppress human summary table")
    .action(async (options: { readonly client?: string; readonly json?: boolean; readonly noSummary?: boolean }) => {
      const clientId = options.client ?? "claude-code";
      const adapter = await getAdapter(clientId);
      const cwd = process.cwd();

      const cliAvailable = (await adapter.checkAvailable?.()) ?? true;
      const caps = (await adapter.capabilities?.()) ?? { supportsProject: true, supportsUser: true, emulateProjectWithUser: false, supportsGlobalExplicit: false };

      const projectPath = join(cwd, ".mcp.json");
      const projectCheck = await checkPath(projectPath);

      const user = await adapter.readUser();
      const userPath = user.source;
      const userCheck = userPath ? await checkPath(userPath) : undefined;

      const project = await adapter.readProject(cwd);
      const conflicts: string[] = [];
      for (const [name, json] of Object.entries(project.mcpServers)) {
        const u = user.mcpServers[name];
        if (u && JSON.stringify(u) !== JSON.stringify(json)) conflicts.push(name);
      }

      const state = await readProjectState(cwd);
      const last = state?.runs?.[0];

      const hasErrors = !cliAvailable;
      const hasWarns = (conflicts.length > 0) || !projectCheck.writable || (userCheck && userCheck.writable === false) || !last;
      const status: DoctorReport["status"] = hasErrors ? "error" : hasWarns ? "warn" : "ok";

      // Local overrides classification (simple: last intent=local -> list entries)
      const localOverrides = last && last.intent === "local"
        ? Object.entries(last.entries)
            .filter(([,e]) => e.outcome === "add" || e.outcome === "update" || e.outcome === "remove" || e.outcome === "skip")
            .map(([name, e]) => ({ name, scope: e.scope as ("project"|"user"), action: e.outcome as ("add"|"update"|"remove"|"skip") }))
        : [];

      const report: DoctorReport = {
        client: adapter.id,
        cli: { available: cliAvailable },
        project: { path: projectCheck.path, readable: projectCheck.readable, writable: projectCheck.writable },
        user: userCheck ? { path: userCheck.path, readable: userCheck.readable, writable: userCheck.writable } : {},
        conflicts,
        capabilities: caps,
        status,
        realized: last ? { at: last.at, requestedScope: last.requestedScope, realizedScope: last.realizedScope, mode: last.mode } : undefined,
        localOverrides,
      };

      const fmt = resolveFormatFlags(process.argv, options);
      console.log(JSON.stringify(report, null, 2));
      if (!fmt.json && !fmt.noSummary) {
        // Human-friendly summary
        console.log("Doctor Summary:");
        const headers = ["Item", "Value"] as const;
        const rows: Array<[string, string]> = [
          ["Client", report.client],
          ["CLI Available", String(report.cli?.available ?? false)],
          ["Project Path", String(report.project?.path ?? "")],
          ["Project R/W", `${report.project?.readable ? "R" : "-"}${report.project?.writable ? "W" : "-"}`],
          ["User Path", String(report.user?.path ?? "")],
          ["User R/W", `${report.user?.readable ? "R" : "-"}${report.user?.writable ? "W" : "-"}`],
          ["Conflicts", report.conflicts && report.conflicts.length > 0 ? report.conflicts.join(", ") : "none"],
          ["Status", report.status],
        ];
        const w = (i: 0 | 1) => Math.max(headers[i].length, ...rows.map((r) => r[i].length));
        const widths = [w(0), w(1)] as const;
        const pad = (s: string, i: 0 | 1) => s.padEnd(widths[i], " ");
        const line = (a: string, b: string) => console.log(`${pad(a, 0)}  |  ${pad(b, 1)}`);
        line(headers[0], headers[1]);
        console.log(`${"".padEnd(widths[0], "-")}--+--${"".padEnd(widths[1], "-")}`);
        for (const [a, b] of rows) line(a, b);
        const recs: string[] = [];
        if (!cliAvailable) recs.push("Install or expose client CLI in PATH.");
        if (!projectCheck.writable) recs.push("Make project .mcp.json writable or run with appropriate permissions.");
        if (userCheck && userCheck.writable === false) recs.push("Fix user settings permissions.");
        if (conflicts.length > 0) recs.push("Resolve project/user conflicts or run install with desired scope.");
        if (!last) recs.push("Run 'kc install' to record local state for diagnostics.");
        if (recs.length > 0) {
          console.log("Recommendations:");
          for (const r of recs) console.log(`- ${r}`);
        }
      }
    });
}
