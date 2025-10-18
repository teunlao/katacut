import type { Command } from "commander";
import { registerMcpAdd } from "./add.js";
import { registerMcpList } from "./list.js";
import { registerMcpRemove } from "./remove.js";

export function registerMcpCommand(program: Command) {
	const mcp = program.command("mcp").description("MCP utilities");
	registerMcpList(mcp);
	registerMcpRemove(mcp);
	registerMcpAdd(mcp);
}
