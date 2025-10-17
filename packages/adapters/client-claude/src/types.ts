export type ClaudeScope = "user" | "project";

export interface ClaudeServerJsonHttp {
  readonly type: "http";
  readonly url: string;
  readonly headers?: Record<string, string>;
}

export interface ClaudeServerJsonStdio {
  readonly type: "stdio";
  readonly command: string;
  readonly args?: string[];
  readonly env?: Record<string, string>;
}

export type ClaudeServerJson = ClaudeServerJsonHttp | ClaudeServerJsonStdio;

