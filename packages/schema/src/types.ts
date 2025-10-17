export interface ProfileConfig {
	extends?: string | string[];
	env?: Record<string, string>;
}

export type McpTransport = "http" | "stdio" | "websocket" | "command";

export interface McpPermissions {
	filesystem?: string[];
	network?: string[];
}

export interface McpServerConfig {
	transport: McpTransport;
	url?: string;
	command?: string;
	args?: string[];
	env?: Record<string, string>;
	headers?: Record<string, string>;
	permissions?: McpPermissions;
}

export interface MetadataConfig {
	name?: string;
	description?: string;
}

export interface KatacutConfig {
	$schema?: string;
	version?: string;
	metadata?: MetadataConfig;
	profiles?: Record<string, ProfileConfig>;
	mcp?: Record<string, McpServerConfig>;
}
