import { CelestialBodyLocation, generateRandomAsteroidBeltClusterCenterKm } from './celestial-body-location';
import {
	DEFAULT_SHIP_MODEL,
	DEFAULT_SHIP_TIER,
	ShipKinematics,
} from './ship-list';
import { ShipUpsertPayload } from './ship-upsert';

function hashToSeed(input: string): number {
	let hash = 2166136261;
	for (let i = 0; i < input.length; i++) {
		hash ^= input.charCodeAt(i);
		hash = Math.imul(hash, 16777619);
	}
	return hash >>> 0;
}

function seededRandom(seed: number): () => number {
	let state = seed >>> 0;
	return () => {
		state = (Math.imul(1664525, state) + 1013904223) >>> 0;
		return state / 0x100000000;
	};
}

function buildStarterShipKinematics(location: CelestialBodyLocation, random: () => number): ShipKinematics {
	const { x, y, z } = location.positionKm;
	const planar = Math.hypot(x, z);
	const tangentX = planar > 0 ? -z / planar : 0;
	const tangentZ = planar > 0 ? x / planar : 1;

	// Realistic asteroid-belt-ish speed with slight deterministic variance.
	const speedKmPerSec = 15 + random() * 5;

	return {
		position: { x, y, z },
		velocity: {
			x: +(tangentX * speedKmPerSec).toFixed(4),
			y: +((random() - 0.5) * 0.08).toFixed(4),
			z: +(tangentZ * speedKmPerSec).toFixed(4),
		},
		reference: {
			solarSystemId: 'sol',
			referenceKind: 'barycentric',
			distanceUnit: 'km',
			velocityUnit: 'km/s',
			epochMs: Date.now(),
		},
	};
}

export function generateDeterministicStarterShipUpdate(
	playerName: string,
	characterId: string,
	shipId: string,
): ShipUpsertPayload {
	const random = seededRandom(hashToSeed(`${playerName}::${characterId}`));
	const center = generateRandomAsteroidBeltClusterCenterKm(random);
	const location: CelestialBodyLocation = { positionKm: center };
	const kinematics = buildStarterShipKinematics(location, random);

	return {
		id: shipId,
		model: DEFAULT_SHIP_MODEL,
		tier: DEFAULT_SHIP_TIER,
		location,
		kinematics,
	} satisfies ShipUpsertPayload;
}
