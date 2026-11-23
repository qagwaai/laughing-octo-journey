import { Camera, Vector3 } from 'three';

export interface RouteHazardMarker {
  position: [number, number, number];
  message: string;
}

export interface RouteHazardCluster {
  key: string;
  position: [number, number, number];
  messages: string[];
}

const BADGE_SIZE_PX = 44;

export function clusterRouteHazards(
  markers: RouteHazardMarker[],
  camera: Camera,
  viewport: { width: number; height: number },
): RouteHazardCluster[] {
  if (viewport.width <= 0 || viewport.height <= 0) return [];
  camera.updateMatrixWorld();
  const groups: { position: [number, number, number]; x: number; y: number; indices: number[]; messages: string[] }[] = [];
  const cells = new Map<string, number[]>();
  const cellKey = (x: number, y: number) => `${x},${y}`;

  markers.forEach((marker, index) => {
    const projected = new Vector3(...marker.position).project(camera);
    if (![projected.x, projected.y, projected.z].every(Number.isFinite) || projected.z < -1 || projected.z > 1) return;
    const x = ((projected.x + 1) * viewport.width) / 2;
    const y = ((1 - projected.y) * viewport.height) / 2;
    if (x < -BADGE_SIZE_PX || x > viewport.width + BADGE_SIZE_PX ||
        y < -BADGE_SIZE_PX || y > viewport.height + BADGE_SIZE_PX) return;
    const cellX = Math.floor(x / BADGE_SIZE_PX);
    const cellY = Math.floor(y / BADGE_SIZE_PX);
    let match: typeof groups[number] | undefined;
    for (let dx = -1; dx <= 1 && !match; dx++) {
      for (let dy = -1; dy <= 1 && !match; dy++) {
        for (const groupIndex of cells.get(cellKey(cellX + dx, cellY + dy)) ?? []) {
          const group = groups[groupIndex];
          if (Math.abs(group.x - x) < BADGE_SIZE_PX && Math.abs(group.y - y) < BADGE_SIZE_PX) {
            match = group;
            break;
          }
        }
      }
    }
    if (match) {
      match.indices.push(index);
      match.messages.push(marker.message);
    } else {
      const key = cellKey(cellX, cellY);
      const bucket = cells.get(key) ?? [];
      bucket.push(groups.length);
      cells.set(key, bucket);
      groups.push({ position: marker.position, x, y, indices: [index], messages: [marker.message] });
    }
  });
  return groups.map((group) => ({
    key: group.indices.join(','),
    position: group.position,
    messages: group.messages,
  }));
}
