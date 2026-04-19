import { getHeadingUnitVector, getVectorMagnitude, summarizeDroneMotion } from './kinematics';
import { DroneKinematics } from './drone-list';

describe('kinematics helpers', () => {
	it('computes vector magnitude for velocity', () => {
		expect(getVectorMagnitude({ x: 3, y: 4, z: 0 })).toBe(5);
	});

	it('returns normalized heading for non-zero velocity', () => {
		const heading = getHeadingUnitVector({ x: 10, y: 0, z: 0 });
		expect(heading).toEqual({ x: 1, y: 0, z: 0 });
	});

	it('returns null heading for near-zero velocity', () => {
		const heading = getHeadingUnitVector({ x: 0, y: 0, z: 0 });
		expect(heading).toBeNull();
	});

	it('summarizes speed and heading from kinematics', () => {
		const kinematics: DroneKinematics = {
			position: { x: 1000, y: 2000, z: 3000 },
			velocity: { x: 6, y: 8, z: 0 },
			reference: {
				solarSystemId: 'sol',
				referenceKind: 'barycentric',
				distanceUnit: 'km',
				velocityUnit: 'km/s',
				epochMs: 1713523200000,
			},
		};

		const summary = summarizeDroneMotion(kinematics);
		expect(summary.speedKmPerSec).toBe(10);
		expect(summary.headingUnitVector).toEqual({ x: 0.6, y: 0.8, z: 0 });
	});
});
