import type { Command } from 'commander';
import { getAdapter } from '../../lib/adapters/registry.js';

export function registerMcpList(parent: Command) {
	parent
		.command('list')
		.description('List MCP servers for the specified client')
		.requiredOption('--client <name>', "Client id (only 'claude-code' is supported)")
		.option('--scope <scope>', 'Scope: project|user (default: both)')
		.action(async (opts: { client: string; scope?: 'project' | 'user' }) => {
			const adapter = await getAdapter(opts.client);
			const out: Record<string, unknown> = {};
			const cwd = process.cwd();
			if (!opts.scope || opts.scope === 'project') {
				const project = await adapter.readProject(cwd);
				const projectOut: Record<string, unknown> = { mcpServers: project.mcpServers };
				if (project.source !== undefined) projectOut.source = project.source;
				out.project = projectOut;
			}
			if (!opts.scope || opts.scope === 'user') {
				const user = await adapter.readUser();
				const userOut: Record<string, unknown> = { mcpServers: user.mcpServers };
				if (user.source !== undefined) userOut.source = user.source;
				out.user = userOut;
			}
			console.log(JSON.stringify({ client: adapter.id, ...out }, null, 2));
		});
}
