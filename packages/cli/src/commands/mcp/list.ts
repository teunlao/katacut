import type { Command } from "commander";
import { readProjectMcp, readUserMcp } from "@katacut/adapter-client-claude";

export function registerMcpList(parent: Command) {
  parent
    .command("list")
    .description("List MCP servers for the specified client")
    .requiredOption("--client <name>", "Client id (only 'claude-code' is supported)")
    .option("--scope <scope>", "Scope: project|user (default: both)")
    .action(async (opts: { client: string; scope?: "project" | "user" }) => {
      if (opts.client !== "claude-code") {
        throw new Error("Only --client claude-code is supported in this POC");
      }
      const out: Record<string, unknown> = {};
      const cwd = process.cwd();
      if (!opts.scope || opts.scope === "project") {
        const project = await readProjectMcp(cwd);
        out.project = { source: project.source ?? null, mcpServers: project.mcpServers };
      }
      if (!opts.scope || opts.scope === "user") {
        const user = await readUserMcp();
        out.user = { source: user.source ?? null, mcpServers: user.mcpServers };
      }
      console.log(JSON.stringify({ client: "claude-code", ...out }, null, 2));
    });
}

