import {
	canReachSolarSystemViaJumpGates,
	resolveJumpGateHops,
	type JumpGateLink,
} from './jump-gate';

describe('jump-gate model', () => {
	const links: JumpGateLink[] = [
		{ fromSolarSystemId: 'sol', toSolarSystemId: 'alpha-centauri', gateId: 'g1' },
		{ fromSolarSystemId: 'alpha-centauri', toSolarSystemId: 'barnards-star', gateId: 'g2' },
	];

	it('returns 0 hops for same solar system', () => {
		expect(resolveJumpGateHops('sol', 'sol', 4, links)).toBe(0);
	});

	it('resolves direct route in one hop', () => {
		expect(resolveJumpGateHops('sol', 'alpha-centauri', 4, links)).toBe(1);
	});

	it('resolves multi-hop route', () => {
		expect(resolveJumpGateHops('sol', 'barnards-star', 4, links)).toBe(2);
	});

	it('returns null when no route exists', () => {
		expect(resolveJumpGateHops('sol', 'wolf-359', 4, links)).toBeNull();
	});

	it('returns false when route exceeds max hops', () => {
		expect(canReachSolarSystemViaJumpGates('sol', 'barnards-star', 1, links)).toBeFalse();
	});
});
