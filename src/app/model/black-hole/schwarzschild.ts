/**
 * Null-geodesic orbit equation in Schwarzschild-radius units:
 * d²x/dλ² = -3 L² x / (2 r⁵). λ is an affine parameter, not travel time.
 * This reference integrates in the orbital plane using velocity Verlet.
 */
export const SCHWARZSCHILD_CRITICAL_IMPACT_RS = (3 * Math.sqrt(3)) / 2;
export const BLACK_HOLE_TRACE_STEP_FRACTION = 0.045;

export function traceSchwarzschildRay(
  impactRs: number,
  stepFraction = BLACK_HOLE_TRACE_STEP_FRACTION,
): { captured: boolean; escaped: boolean; deflectionRad: number } {
  if (!Number.isFinite(impactRs) || impactRs < 0 || !Number.isFinite(stepFraction) || stepFraction <= 0) {
    throw new Error('Ray impact must be finite and non-negative; step fraction must be finite and positive.');
  }
  let x = impactRs;
  let z = 100;
  let vx = 0;
  let vz = -1;
  const angularMomentumSquared = impactRs * impactRs;
  for (let i = 0; i < 20_000; i++) {
    const r = Math.hypot(x, z);
    if (r < 1) return { captured: true, escaped: false, deflectionRad: 0 };
    if (r > 110 && x * vx + z * vz > 0) {
      return { captured: false, escaped: true, deflectionRad: Math.atan2(-vx, -vz) };
    }
    const dt = Math.min(2, r * stepFraction);
    const f = (-1.5 * angularMomentumSquared) / r ** 5;
    const ax = f * x;
    const az = f * z;
    x += vx * dt + 0.5 * ax * dt * dt;
    z += vz * dt + 0.5 * az * dt * dt;
    const nextR = Math.hypot(x, z);
    const nextF = (-1.5 * angularMomentumSquared) / nextR ** 5;
    vx += 0.5 * (ax + nextF * x) * dt;
    vz += 0.5 * (az + nextF * z) * dt;
  }
  throw new Error('Schwarzschild reference ray did not converge.');
}
