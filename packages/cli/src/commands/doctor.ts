import { constants } from "node:fs";
import { access } from "node:fs/promises";
import { join } from "node:path";

import type { Command } from "commander";
import { getAdapter } from "../lib/adapters/registry.js";

interface PathCheck { readonly path: string; readonly readable?: boolean; readonly writable?: boolean }

interface DoctorReport {
  readonly client: string;
  readonly cli?: { readonly available: boolean };
  readonly project?: { readonly path: string; readonly readable?: boolean; readonly writable?: boolean };
  readonly user?: { readonly path?: string; readonly readable?: boolean; readonly writable?: boolean };
  readonly conflicts?: readonly string[];
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
    .action(async (options: { readonly client?: string }) => {
      const clientId = options.client ?? "claude-code";
      const adapter = await getAdapter(clientId);
      const cwd = process.cwd();

      const cliAvailable = (await adapter.checkAvailable?.()) ?? true;

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

      const hasErrors = !cliAvailable;
      const hasWarns = (conflicts.length > 0) || !projectCheck.writable || (userCheck && userCheck.writable === false);
      const status: DoctorReport["status"] = hasErrors ? "error" : hasWarns ? "warn" : "ok";

      const report: DoctorReport = {
        client: adapter.id,
        cli: { available: cliAvailable },
        project: { path: projectCheck.path, readable: projectCheck.readable, writable: projectCheck.writable },
        user: userCheck ? { path: userCheck.path, readable: userCheck.readable, writable: userCheck.writable } : {},
        conflicts,
        status,
      };

      console.log(JSON.stringify(report, null, 2));
    });
}
