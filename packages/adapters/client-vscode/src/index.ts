export interface VscodeSyncAction {
  readonly type: 'command' | 'write' | 'noop';
  readonly payload: unknown;
}

export function planVscodeSync(): VscodeSyncAction[] {
  return [];
}
