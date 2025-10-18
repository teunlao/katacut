export type Transport = "http" | "stdio";

export interface ServerJsonHttp {
	readonly type: "http";
	readonly url: string;
	readonly headers?: Record<string, string>;
}

export interface ServerJsonStdio {
	readonly type: "stdio";
	readonly command: string;
	readonly args?: string[];
	readonly env?: Record<string, string>;
}

export type ServerJson = ServerJsonHttp | ServerJsonStdio;

export interface ReadMcpResult {
	readonly source?: string;
	readonly mcpServers: Record<string, ServerJson>;
}

export type Scope = "project" | "user";

export interface InstallStep {
	readonly action: "add" | "update" | "remove";
	readonly name: string;
	readonly json?: ServerJson;
}

export interface ApplyResultSummary {
	readonly added: number;
	readonly updated: number;
	readonly removed: number;
	readonly failed: number;
}

export interface AdapterCapabilities {
	readonly supportsProject: boolean;
	readonly supportsUser: boolean;
	readonly emulateProjectWithUser: boolean;
	readonly supportsGlobalExplicit: boolean;
}

export interface ClientAdapter {
	readonly id: string;
	readProject(cwd?: string): Promise<ReadMcpResult>;
	readUser(): Promise<ReadMcpResult>;
	desiredFromConfig(config: unknown): Record<string, ServerJson>;
	applyInstall(plan: readonly InstallStep[], scope: Scope, cwd?: string): Promise<ApplyResultSummary>;
	checkAvailable?(): Promise<boolean>;
	capabilities?(): Promise<AdapterCapabilities> | AdapterCapabilities;
}
