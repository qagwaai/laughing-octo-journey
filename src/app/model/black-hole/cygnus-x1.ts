/** Miller-Jones et al. (2021), Table 1; values are not HYG-derived estimates. */
export const CYGNUS_X1 = {
  id: 'demo-cygnus-x1',
  hygCompanionId: '97987',
  blackHoleMassSolar: 21.2,
  companionMassSolar: 40.6,
  companionRadiusSolar: 22.3,
  companionTemperatureK: 31_138,
  separationAu: 0.244,
  separationBoundsAu: [0.231, 0.256],
  orbitalPeriodDays: 5.6,
  eccentricity: 0.0189,
  distanceParsec: 2220,
  orbitalInclinationDeg: 27.51,
} as const;

export const CYGNUS_X1_REFERENCES = [
  {
    href: 'https://arxiv.org/abs/2102.09091',
    text: 'Miller-Jones et al. (2021): Cygnus X-1',
  },
  {
    href: 'https://arxiv.org/abs/2411.12507',
    text: 'Jiang (2024): Cygnus X-1 review',
  },
] as const;

export const ASTRONOMICAL_UNIT_KM = 149_597_870.7;
export const SOLAR_RADIUS_KM = 695_700;
/** 2GM/c² per solar mass; this is a reference scale, not a Kerr horizon radius. */
export const SCHWARZSCHILD_KM_PER_SOLAR_MASS = 2.95325;
export const CYGNUS_X1_SCHWARZSCHILD_RADIUS_KM = CYGNUS_X1.blackHoleMassSolar * SCHWARZSCHILD_KM_PER_SOLAR_MASS;

/** Authored presentation only; never used as physical binary coordinates. */
export const CYGNUS_X1_SPLASH_PRESENTATION = {
  observerRadiusRs: 26,
  diskInnerRadiusRs: 3,
  diskOuterRadiusRs: 9,
  imageWidthRs: 24,
  imageHeightRs: 20,
} as const;

export const BLACK_HOLE_SPLASH_QUALITY = {
  low: { resolution: 320, traceSteps: 256 },
  standard: { resolution: 640, traceSteps: 384 },
} as const;
