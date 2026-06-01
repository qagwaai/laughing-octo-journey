import type { ExternalObjectDescriptor } from './external-object-descriptor';

export interface FloatingDebrisItem {
  id: string;
  itemType: string;
  displayName: string;
  externalObjectDescriptor?: ExternalObjectDescriptor | null;
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
