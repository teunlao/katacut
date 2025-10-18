import type { ServerJson } from "@katacut/core";
import type { McpServerConfig } from "@katacut/schema";
import type { GeminiServerJson } from "./types.js";

export function toGeminiServerJson(server: McpServerConfig): GeminiServerJson {
	if (server.transport === "http") {
		return { type: "http", transport: "http", httpUrl: server.url, headers: server.headers };
	}
	if (server.transport === "sse") {
		return { type: "http", transport: "sse", httpUrl: server.url, headers: server.headers };
	}
	// stdio
	return { type: "stdio", command: server.command, args: server.args, env: server.env };
}

export function fromGeminiServerJson(entry: unknown): ServerJson | undefined {
	if (!entry || typeof entry !== "object") return undefined;
	const obj = entry as Record<string, unknown>;
	// HTTP/SSE style
	if (typeof obj.httpUrl === "string") {
		const url = obj.httpUrl;
		// We normalize both http and sse to http transport in our domain for now
		const headers =
			obj.headers && typeof obj.headers === "object"
				? Object.fromEntries(
						Object.entries(obj.headers as Record<string, unknown>).filter(([, v]) => typeof v === "string") as [
							string,
							string,
						][],
					)
				: undefined;
		return { type: "http", url, headers };
	}
	if (typeof obj.url === "string") {
		const headers =
			obj.headers && typeof obj.headers === "object"
				? Object.fromEntries(
						Object.entries(obj.headers as Record<string, unknown>).filter(([, v]) => typeof v === "string") as [
							string,
							string,
						][],
					)
				: undefined;
		return { type: "sse", url: obj.url, headers };
	}
	// STDIO style
	if (typeof obj.command === "string") {
		const args = Array.isArray(obj.args) ? (obj.args.filter((a) => typeof a === "string") as string[]) : undefined;
		const env =
			obj.env && typeof obj.env === "object"
				? Object.fromEntries(
						Object.entries(obj.env as Record<string, unknown>).filter(([, v]) => typeof v === "string") as [
							string,
							string,
						][],
					)
				: undefined;
		return { type: "stdio", command: obj.command, args, env };
	}
	return undefined;
}
