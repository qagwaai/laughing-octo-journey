export interface FloatingDebrisItem {
  id: string;
  itemType: string;
  displayName: string;
  positionKm: {
    x: number;
    y: number;
    z: number;
  };
  velocityKmPerSec?: {
    x: number;
    y: number;
    z: number;
  };
  state?: string;
  damageStatus?: string;
}
