export interface CursorSyncAction {
	readonly type: "write" | "noop";
	readonly target: string;
}

export function planCursorSync(): CursorSyncAction[] {
	return [];
}
