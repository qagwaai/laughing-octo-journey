export interface JumpGateLink {
	fromSolarSystemId: string;
	toSolarSystemId: string;
	gateId: string;
}

export const KNOWN_JUMP_GATE_LINKS: readonly JumpGateLink[] = [
	{ fromSolarSystemId: 'sol', toSolarSystemId: 'alpha-centauri', gateId: 'sol-ac-g1' },
	{ fromSolarSystemId: 'alpha-centauri', toSolarSystemId: 'sol', gateId: 'ac-sol-g1' },
	{ fromSolarSystemId: 'alpha-centauri', toSolarSystemId: 'barnards-star', gateId: 'ac-bs-g1' },
	{ fromSolarSystemId: 'barnards-star', toSolarSystemId: 'alpha-centauri', gateId: 'bs-ac-g1' },
];

interface TraversalNode {
	solarSystemId: string;
	hops: number;
}

export function resolveJumpGateHops(
	fromSolarSystemId: string,
	toSolarSystemId: string,
	maxHops = 4,
	links: readonly JumpGateLink[] = KNOWN_JUMP_GATE_LINKS,
): number | null {
	const start = fromSolarSystemId.trim().toLowerCase();
	const target = toSolarSystemId.trim().toLowerCase();
	if (!start || !target) {
		return null;
	}

	if (start === target) {
		return 0;
	}

	const visited = new Set<string>([start]);
	const queue: TraversalNode[] = [{ solarSystemId: start, hops: 0 }];

	while (queue.length > 0) {
		const current = queue.shift();
		if (!current) {
			break;
		}

		if (current.hops >= maxHops) {
			continue;
		}

		for (const link of links) {
			if (link.fromSolarSystemId.trim().toLowerCase() !== current.solarSystemId) {
				continue;
			}

			const nextSystem = link.toSolarSystemId.trim().toLowerCase();
			if (!nextSystem || visited.has(nextSystem)) {
				continue;
			}

			const nextHops = current.hops + 1;
			if (nextSystem === target) {
				return nextHops;
			}

			visited.add(nextSystem);
			queue.push({ solarSystemId: nextSystem, hops: nextHops });
		}
	}

	return null;
}

export function canReachSolarSystemViaJumpGates(
	fromSolarSystemId: string,
	toSolarSystemId: string,
	maxHops = 4,
	links: readonly JumpGateLink[] = KNOWN_JUMP_GATE_LINKS,
): boolean {
	return resolveJumpGateHops(fromSolarSystemId, toSolarSystemId, maxHops, links) !== null;
}