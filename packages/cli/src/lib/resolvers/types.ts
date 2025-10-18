import type { McpServerConfig } from "@katacut/schema";

export interface ResolvedServer {
  readonly name: string;
  readonly config: McpServerConfig; // normalized to schema format
}

