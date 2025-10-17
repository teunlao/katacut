import type { Command } from "commander";
import { registerMcpList } from "./list.js";

export function registerMcpCommand(program: Command) {
  const mcp = program.command("mcp").description("MCP utilities");
  registerMcpList(mcp);
}

