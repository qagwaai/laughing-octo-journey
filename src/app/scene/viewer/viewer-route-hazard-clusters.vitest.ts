import { OrthographicCamera } from 'three';
import { describe, expect, it } from 'vitest';
import { clusterRouteHazards, type RouteHazardMarker } from './viewer-route-hazard-clusters';

const markers: RouteHazardMarker[] = [
  { position: [0, 0, 0], message: 'Venus surface' },
  { position: [0.4, 0, 0], message: 'Venus atmosphere' },
  { position: [3, 0, 0], message: 'Mercury surface' },
];

describe('clusterRouteHazards', () => {
  it('clusters overlapping badges without losing warnings, and separates them as the view zooms', () => {
    const camera = new OrthographicCamera(-10, 10, 10, -10, 0.1, 100);
    camera.position.z = 10;
    camera.lookAt(0, 0, 0);
    const viewport = { width: 1000, height: 1000 };
    const clusters = clusterRouteHazards(markers, camera, viewport);
    expect(clusters.map((cluster) => cluster.messages)).toEqual([
      ['Venus surface', 'Venus atmosphere'],
      ['Mercury surface'],
    ]);
    expect(clusters[0].position).toEqual(markers[0].position);
    camera.zoom = 3;
    camera.updateProjectionMatrix();
    expect(clusterRouteHazards(markers, camera, viewport).map((cluster) => cluster.messages)).toEqual([
      ['Venus surface'], ['Venus atmosphere'], ['Mercury surface'],
    ]);
  });

  it('does not place badges for warnings behind the camera or outside the view', () => {
    const camera = new OrthographicCamera(-10, 10, 10, -10, 0.1, 100);
    camera.position.z = 10;
    camera.lookAt(0, 0, 0);
    expect(clusterRouteHazards([
      markers[0],
      { position: [0, 0, 20], message: 'behind' },
      { position: [100, 0, 0], message: 'outside' },
    ], camera, { width: 1000, height: 1000 }).map((group) => group.messages)).toEqual([['Venus surface']]);
  });
});
