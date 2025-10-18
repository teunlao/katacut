import type { McpServerConfig } from "@katacut/schema";
import { isServerJson } from "../guards.js";
import type { ResolvedServer } from "./types.js";

export async function resolveJsonDescriptor(u: URL, timeoutMs = 10000, maxSize = 262144): Promise<ResolvedServer> {
	const ctrl = new AbortController();
	const to = setTimeout(() => ctrl.abort(), timeoutMs);
	try {
		const res = await fetch(u, { signal: ctrl.signal, redirect: "follow" });
		const ct = res.headers.get("content-type") ?? "";
		if (!ct.includes("json")) throw new Error(`Unexpected content-type: ${ct}`);
		const text = await res.text();
		if (text.length > maxSize) throw new Error("Descriptor too large");
		const parsed: unknown = JSON.parse(text);
        if (!isServerJson(parsed)) throw new Error("Descriptor is not a valid ServerJson (http|sse|stdio)");
        const cfg: McpServerConfig =
            parsed.type === "http"
                ? { transport: "http", url: parsed.url, headers: parsed.headers }
                : parsed.type === "sse"
                ? // Our schema may not yet support 'sse'; treat as http for config but keep in adapter logic if needed.
                  { transport: "http", url: parsed.url, headers: parsed.headers }
                : { transport: "stdio", command: parsed.command, args: parsed.args, env: parsed.env };
		const name = deriveNameFromUrl(u);
		return { name, config: cfg };
	} finally {
		clearTimeout(to);
	}
}

function deriveNameFromUrl(u: URL): string {
	const path = u.pathname.replace(/\/+$/, "");
	const segments = path.split("/").filter(Boolean);
	const last = segments[segments.length - 1] ?? "server";
	return last.replace(/\.jsonc?$/i, "");
}
