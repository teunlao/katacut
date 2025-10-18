import type { ServerJson } from "@katacut/core";

function isRecord(x: unknown): x is Record<string, unknown> {
	return typeof x === "object" && x !== null && !Array.isArray(x);
}

function isStringRecord(x: unknown): x is Record<string, string> {
	if (!isRecord(x)) return false;
	for (const v of Object.values(x)) if (typeof v !== "string") return false;
	return true;
}

export function isServerJson(x: unknown): x is ServerJson {
    if (!isRecord(x)) return false;
    const t = x.type;
    if (t === "http") {
        return typeof x.url === "string" && (x.headers === undefined || isStringRecord(x.headers));
    }
    if (t === "sse") {
        return typeof x.url === "string" && (x.headers === undefined || isStringRecord(x.headers));
    }
    if (t === "stdio") {
        if (typeof x.command !== "string") return false;
        if (x.args !== undefined && (!Array.isArray(x.args) || x.args.some((a) => typeof a !== "string"))) return false;
        if (x.env !== undefined && !isStringRecord(x.env)) return false;
        return true;
    }
    return false;
}
