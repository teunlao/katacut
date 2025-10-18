export type GeminiScope = 'user' | 'project';

export interface GeminiServerJsonHttp {
	readonly transport: 'http' | 'sse';
	readonly httpUrl: string;
	readonly headers?: Record<string, string>;
	readonly timeout?: number;
}

export interface GeminiServerJsonStdio {
	readonly command: string;
	readonly args?: string[];
	readonly env?: Record<string, string>;
}

export type GeminiServerJson =
	| ({ readonly type: 'http' } & GeminiServerJsonHttp)
	| ({ readonly type: 'stdio' } & GeminiServerJsonStdio);
