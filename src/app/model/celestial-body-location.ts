import { Triple } from './triple';

/**
 * Location of a celestial body (asteroid, planet, moon, etc.) expressed in
 * kilometres relative to the solar system barycenter. Using km keeps the
 * units consistent with {@link ./asteroid-kinematics#AsteroidKinematics}'s
 * `velocityKmPerSec`, while still representing bodies as large as Jupiter
 * (~7.78e8 km from the Sun) or as small as a scanned asteroid.
 */
export interface CelestialBodyLocation {
	/** Position in km, relative to the solar system barycenter. */
	positionKm: Triple;
}

/** Inner edge of the main asteroid belt, ~2.2 AU in km. */
const ASTEROID_BELT_INNER_KM = 3.29e8;
/** Outer edge of the main asteroid belt, ~3.2 AU in km. */
const ASTEROID_BELT_OUTER_KM = 4.79e8;
/**
 * Default spread (radius) in km for a cluster of asteroids that should be
 * visually navigable together. A few thousand km keeps them "close" at solar
 * system scale while still allowing meaningful relative positions.
 */
export const DEFAULT_CLUSTER_SPREAD_KM = 5_000;

function rnd(min: number, max: number, random: () => number = Math.random): number {
	return min + random() * (max - min);
}

function signed(magnitude: number, random: () => number): number {
	return (random() > 0.5 ? 1 : -1) * rnd(0, magnitude, random);
}

/**
 * Pick a plausible cluster center somewhere in the main asteroid belt,
 * roughly in the ecliptic plane.
 */
export function generateRandomAsteroidBeltClusterCenterKm(
	random: () => number = Math.random,
): Triple {
	const angle = rnd(0, Math.PI * 2, random);
	const radius = rnd(ASTEROID_BELT_INNER_KM, ASTEROID_BELT_OUTER_KM, random);
	return {
		x: +(Math.cos(angle) * radius).toFixed(0),
		y: +signed(2.5e6, random).toFixed(0), // modest out-of-plane wobble
		z: +(Math.sin(angle) * radius).toFixed(0),
	};
}

/**
 * Generate a random location near a given cluster center, within a spherical
 * volume of `spreadKm` radius.
 */
export function generateRandomCelestialBodyLocationNear(
	centerKm: Triple,
	spreadKm: number = DEFAULT_CLUSTER_SPREAD_KM,
	random: () => number = Math.random,
): CelestialBodyLocation {
	return {
		positionKm: {
			x: +(centerKm.x + signed(spreadKm, random)).toFixed(0),
			y: +(centerKm.y + signed(spreadKm, random)).toFixed(0),
			z: +(centerKm.z + signed(spreadKm, random)).toFixed(0),
		},
	};
}
