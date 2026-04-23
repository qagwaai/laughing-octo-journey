import { Triple } from './triple';

export interface AsteroidKinematics {
	/** Orbital velocity vector in km/s */
	velocityKmPerSec: Triple;
	/** Spin rate vector in rad/s */
	angularVelocityRadPerSec: Triple;
	/** Estimated mass in kg */
	estimatedMassKg: number;
	/** Estimated diameter in metres */
	estimatedDiameterM: number;
}

function rnd(min: number, max: number, random: () => number = Math.random): number {
	return min + random() * (max - min);
}

function signed(magnitude: number, random: () => number): number {
	return (random() > 0.5 ? 1 : -1) * rnd(0, magnitude, random);
}

export function generateRandomAsteroidKinematics(random: () => number = Math.random): AsteroidKinematics {
	return {
		velocityKmPerSec: {
			x: +signed(28, random).toFixed(3),
			y: +signed(4, random).toFixed(3),
			z: +signed(28, random).toFixed(3),
		},
		angularVelocityRadPerSec: {
			x: +signed(0.08, random).toFixed(4),
			y: +signed(0.12, random).toFixed(4),
			z: +signed(0.06, random).toFixed(4),
		},
		estimatedMassKg: Math.round(rnd(1e10, 9e14, random)),
		estimatedDiameterM: Math.round(rnd(40, 9400, random)),
	};
}
