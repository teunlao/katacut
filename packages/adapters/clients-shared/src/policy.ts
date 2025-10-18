import type { ServerJson } from '@katacut/core';

export type TransportType = ServerJson['type'];

export interface TransportPolicy {
	readonly unsupported?: readonly TransportType[];
	readonly downgrades?: readonly { readonly from: TransportType; readonly to: TransportType }[];
}

export type TransportDecision = 'ok' | { kind: 'fail'; reason: string } | { kind: 'downgrade'; to: TransportType };

export function canApplyTransport(policy: TransportPolicy, server: ServerJson): TransportDecision {
	const t = server.type;
	if (policy.unsupported?.includes(t)) {
		return { kind: 'fail', reason: `transport '${t}' is unsupported by client` };
	}
	const dg = (policy.downgrades ?? []).find((d) => d.from === t);
	if (dg) {
		return { kind: 'downgrade', to: dg.to };
	}
	return 'ok';
}
