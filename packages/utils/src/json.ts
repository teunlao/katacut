export function stableStringify<T>(value: T): string {
	return JSON.stringify(sortDeep(value) as unknown, null, 0);
}

function sortDeep<T>(input: T): T {
	if (Array.isArray(input)) {
		return input.map((x) => sortDeep(x)) as unknown as T;
	}
	if (input && typeof input === "object") {
		const obj = input as Record<string, unknown>;
		const out: Record<string, unknown> = {};
		for (const key of Object.keys(obj).sort()) {
			out[key] = sortDeep(obj[key]);
		}
		return out as unknown as T;
	}
	return input;
}

export function deepEqualStable(a: unknown, b: unknown): boolean {
	return stableStringify(a) === stableStringify(b);
}
