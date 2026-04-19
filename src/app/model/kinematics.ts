import { Triple } from './triple';
import { DroneKinematics } from './drone-list';

const MIN_SPEED_EPSILON_KM_PER_SEC = 1e-9;

export interface DroneMotionSummary {
	speedKmPerSec: number;
	headingUnitVector: Triple | null;
}

export function getVectorMagnitude(vector: Triple): number {
	return Math.sqrt(vector.x ** 2 + vector.y ** 2 + vector.z ** 2);
}

export function getHeadingUnitVector(velocity: Triple): Triple | null {
	const speedKmPerSec = getVectorMagnitude(velocity);
	if (speedKmPerSec <= MIN_SPEED_EPSILON_KM_PER_SEC) {
		return null;
	}

	return {
		x: velocity.x / speedKmPerSec,
		y: velocity.y / speedKmPerSec,
		z: velocity.z / speedKmPerSec,
	};
}

export function summarizeDroneMotion(kinematics: DroneKinematics): DroneMotionSummary {
	return {
		speedKmPerSec: getVectorMagnitude(kinematics.velocity),
		headingUnitVector: getHeadingUnitVector(kinematics.velocity),
	};
}
