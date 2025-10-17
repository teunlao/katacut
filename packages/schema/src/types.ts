export interface ProfileConfig {
	extends?: string | string[];
	env?: Record<string, string>;
}

export type McpTransport = "http" | "stdio";

export type McpScope = "project" | "workspace" | "user" | "global";

export interface McpPermissions {
	filesystem?: string[];
	network?: string[];
}

export interface BaseMcpServerConfig {
	transport: McpTransport;
	name?: string;
	description?: string;
	metadata?: Record<string, unknown>;
	scope?: McpScope;
	permissions?: McpPermissions;
}

export interface HttpMcpServerConfig extends BaseMcpServerConfig {
	transport: "http";
	url: string;
	headers?: Record<string, string>;
}

export interface StdioMcpServerConfig extends BaseMcpServerConfig {
	transport: "stdio";
	command: string;
	args?: string[];
	env?: Record<string, string>;
}

export type McpServerConfig = HttpMcpServerConfig | StdioMcpServerConfig;

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
