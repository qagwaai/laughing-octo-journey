export interface DriveProfile {
  id: 'standard-cruise' | 'rapid-transit' | 'quantum-fold';
  name: string;
  rangeAu: number;
  cruiseSpeedAuPerHour: number;
  fuelCostPerAu: number;
}

export interface DriveProfileInput {
  id?: string | null;
  name?: string | null;
  rangeAu?: number | null;
  cruiseSpeedAuPerHour?: number | null;
  fuelCostPerAu?: number | null;
}

export interface ShipDriveResolverInput {
  model: string;
  tier: number;
  driveProfile?: DriveProfileInput | null;
}

export const STANDARD_CRUISE_DRIVE_PROFILE: DriveProfile = {
  id: 'standard-cruise',
  name: 'Standard Cruise Drive',
  rangeAu: 0.5,
  cruiseSpeedAuPerHour: 0.3,
  fuelCostPerAu: 1,
};

export const RAPID_TRANSIT_DRIVE_PROFILE: DriveProfile = {
  id: 'rapid-transit',
  name: 'Rapid Transit Thruster',
  rangeAu: 15,
  cruiseSpeedAuPerHour: 1.8,
  fuelCostPerAu: 4,
};

export const QUANTUM_FOLD_DRIVE_PROFILE: DriveProfile = {
  id: 'quantum-fold',
  name: 'Quantum Fold Engine',
  rangeAu: 100,
  cruiseSpeedAuPerHour: 12,
  fuelCostPerAu: 20,
};

export const DRIVE_PROFILES_BY_RANGE: readonly DriveProfile[] = [
  STANDARD_CRUISE_DRIVE_PROFILE,
  RAPID_TRANSIT_DRIVE_PROFILE,
  QUANTUM_FOLD_DRIVE_PROFILE,
];

function coerceDriveId(rawId: string): DriveProfile['id'] {
  if (rawId === 'rapid-transit' || rawId === 'quantum-fold') {
    return rawId;
  }

  return 'standard-cruise';
}

export function coerceDriveProfile(input: DriveProfileInput | null | undefined): DriveProfile | null {
  if (!input) {
    return null;
  }

  const name = input.name?.trim();
  const rangeAu = typeof input.rangeAu === 'number' ? input.rangeAu : Number.NaN;
  const cruiseSpeedAuPerHour = typeof input.cruiseSpeedAuPerHour === 'number' ? input.cruiseSpeedAuPerHour : Number.NaN;
  const fuelCostPerAu = typeof input.fuelCostPerAu === 'number' ? input.fuelCostPerAu : Number.NaN;

  if (!name || !Number.isFinite(rangeAu) || !Number.isFinite(cruiseSpeedAuPerHour) || !Number.isFinite(fuelCostPerAu)) {
    return null;
  }

  if (rangeAu <= 0 || cruiseSpeedAuPerHour <= 0 || fuelCostPerAu < 0) {
    return null;
  }

  return {
    id: coerceDriveId((input.id ?? '').trim().toLowerCase()),
    name,
    rangeAu,
    cruiseSpeedAuPerHour,
    fuelCostPerAu,
  };
}

export function resolveDriveProfileForShip(ship: ShipDriveResolverInput | null): DriveProfile {
  if (!ship) {
    return STANDARD_CRUISE_DRIVE_PROFILE;
  }

  const explicitProfile = coerceDriveProfile(ship.driveProfile);
  if (explicitProfile) {
    return explicitProfile;
  }

  const model = ship.model.trim().toLowerCase();
  if (model.includes('quantum') || ship.tier >= 6) {
    return QUANTUM_FOLD_DRIVE_PROFILE;
  }

  if (model.includes('rapid') || ship.tier >= 3) {
    return RAPID_TRANSIT_DRIVE_PROFILE;
  }

  return STANDARD_CRUISE_DRIVE_PROFILE;
}

export function resolveMinimumDriveProfileForDistance(distanceAu: number): DriveProfile {
  if (!Number.isFinite(distanceAu) || distanceAu <= 0) {
    return STANDARD_CRUISE_DRIVE_PROFILE;
  }

  return DRIVE_PROFILES_BY_RANGE.find((profile) => distanceAu <= profile.rangeAu) ?? QUANTUM_FOLD_DRIVE_PROFILE;
}

export function estimateTravelHours(distanceAu: number, profile: DriveProfile): number {
  if (!Number.isFinite(distanceAu) || distanceAu <= 0) {
    return 0;
  }

  if (profile.cruiseSpeedAuPerHour <= 0) {
    return Number.POSITIVE_INFINITY;
  }

  return distanceAu / profile.cruiseSpeedAuPerHour;
}
