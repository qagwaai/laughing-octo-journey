import { ChangeDetectionStrategy, Component, computed, CUSTOM_ELEMENTS_SCHEMA, input } from '@angular/core';
import { NgtArgs } from 'angular-three';
import { Euler, Quaternion, Vector3 } from 'three';
import { directionFromEquirect } from '../../model/planet/planet-surface';

export type PlanetVolcanismQuality = 'overview' | 'detail';

const IO_VOLCANIC_CUES = [
  { id: 'a', u: 0.14, v: 0.43, scale: 1 },
  { id: 'b', u: 0.39, v: 0.59, scale: 0.82 },
  { id: 'c', u: 0.68, v: 0.36, scale: 0.92 },
  { id: 'd', u: 0.87, v: 0.55, scale: 0.76 },
] as const;

export interface IoVolcanicCue {
  id: string;
  position: [number, number, number];
  rotation: [number, number, number];
  hotspotRadius: number;
  haloRadius: number;
  haloThickness: number;
  plumeRadius: number;
  plumeHeight: number;
  sphereSegments: number;
  plumeSegments: number;
}

export function createIoVolcanicCues(radius: number, quality: PlanetVolcanismQuality): IoVolcanicCue[] {
  if (!Number.isFinite(radius) || radius <= 0) {
    throw new Error(`Io volcanic cue radius must be positive and finite; received ${radius}.`);
  }

  const detail = quality === 'detail';
  return IO_VOLCANIC_CUES.map(({ id, u, v, scale }) => {
    const [x, y, z] = directionFromEquirect(u, v);
    const normal = new Vector3(x, y, z);
    const orientation = new Euler().setFromQuaternion(
      new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), normal),
    );
    return {
      id,
      position: [normal.x * radius * 1.003, normal.y * radius * 1.003, normal.z * radius * 1.003],
      rotation: [orientation.x, orientation.y, orientation.z],
      hotspotRadius: radius * 0.018 * scale,
      haloRadius: radius * 0.038 * scale,
      haloThickness: radius * 0.002,
      plumeRadius: radius * 0.012 * scale,
      plumeHeight: radius * 0.11 * scale,
      sphereSegments: detail ? 12 : 8,
      plumeSegments: detail ? 8 : 5,
    };
  });
}

@Component({
  selector: 'app-planet-volcanism-layer',
  imports: [NgtArgs],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @for (cue of cues(); track cue.id) {
      <ngt-group [name]="'Io volcanic cue ' + cue.id" [position]="cue.position" [rotation]="cue.rotation">
        <ngt-mesh
          [name]="'Io volcanic halo ' + cue.id"
          [position]="[0, cue.haloThickness / 2, 0]"
          [scale]="[cue.haloRadius, cue.haloThickness, cue.haloRadius]"
          [renderOrder]="3"
        >
          <ngt-sphere-geometry *args="[1, cue.sphereSegments, cue.sphereSegments]" />
          <ngt-mesh-basic-material
            [color]="'#ff672d'"
            [transparent]="true"
            [opacity]="0.18"
            [depthWrite]="false"
            [toneMapped]="false"
          />
        </ngt-mesh>
        <ngt-mesh
          [name]="'Io volcanic hotspot ' + cue.id"
          [position]="[0, cue.hotspotRadius * 0.3, 0]"
          [renderOrder]="4"
        >
          <ngt-sphere-geometry *args="[cue.hotspotRadius, cue.sphereSegments, cue.sphereSegments]" />
          <ngt-mesh-basic-material [color]="'#ffad47'" [toneMapped]="false" />
        </ngt-mesh>
        <ngt-mesh
          [name]="'Io volcanic plume ' + cue.id"
          [position]="[0, cue.plumeHeight / 2, 0]"
          [renderOrder]="4"
        >
          <ngt-cone-geometry *args="[cue.plumeRadius, cue.plumeHeight, cue.plumeSegments, 1]" />
          <ngt-mesh-basic-material
            [color]="'#ffc66e'"
            [transparent]="true"
            [opacity]="0.28"
            [depthWrite]="false"
            [side]="2"
            [toneMapped]="false"
          />
        </ngt-mesh>
      </ngt-group>
    }
  `,
})
export class PlanetVolcanismLayer {
  readonly radius = input.required<number>();
  readonly quality = input<PlanetVolcanismQuality>('overview');
  protected readonly cues = computed(() => createIoVolcanicCues(this.radius(), this.quality()));
}
