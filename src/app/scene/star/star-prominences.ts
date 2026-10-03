/**
 * Prominence loops for procedural stars.
 *
 * A fixed pool of additive half-torus arcs. Each active flare sample raises a
 * loop rooted at its surface point; the loop grows and fades with the flare's
 * envelope. The pool lives inside the star's spinning frame, so loops ride the
 * surface.
 */
import { AdditiveBlending, Color, Group, Mesh, MeshBasicMaterial, Quaternion, TorusGeometry, Vector3 } from 'three';
import type { StarProfile } from '../../model/star/star-profile';
import { STAR_MAX_ACTIVE_FLARES, type StarFlareSample } from './star-flares';
import { linearStarColor } from './star-photosphere-material';

export interface StarProminenceHandle {
  readonly group: Group;
  readonly loops: readonly Mesh<TorusGeometry, MeshBasicMaterial>[];
  update(samples: readonly StarFlareSample[]): void;
  dispose(): void;
}

const UP = new Vector3(0, 1, 0);

export function createStarProminences(profile: StarProfile, radius: number): StarProminenceHandle {
  const group = new Group();
  group.name = 'star-prominences';
  // Loops are the hot plasma colour, slightly whiter than the surface.
  const color = new Color().copy(linearStarColor(profile.color)).lerp(new Color(1, 0.55, 0.35), 0.35);
  const geometry = new TorusGeometry(1, 0.07, 6, 36, Math.PI);
  const loopSize = radius * 0.22 * profile.prominenceScale;

  const loops = Array.from({ length: STAR_MAX_ACTIVE_FLARES }, (_, index) => {
    const material = new MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0,
      blending: AdditiveBlending,
      depthWrite: false,
      toneMapped: true,
    });
    const loop = new Mesh(geometry, material);
    loop.name = `star-prominence-${index}`;
    loop.visible = false;
    loop.raycast = () => undefined;
    group.add(loop);
    return loop;
  });

  const direction = new Vector3();
  const orientation = new Quaternion();

  return {
    group,
    loops,
    update(samples) {
      loops.forEach((loop, index) => {
        const sample = samples[index];
        if (!sample || sample.envelope <= 0.001 || loopSize <= 0) {
          loop.visible = false;
          return;
        }
        direction.set(sample.direction[0], sample.direction[1], sample.direction[2]).normalize();
        orientation.setFromUnitVectors(UP, direction);
        loop.quaternion.copy(orientation);
        loop.position.copy(direction).multiplyScalar(radius * 0.97);
        loop.scale.setScalar(loopSize * sample.size * (0.45 + 0.55 * sample.envelope));
        loop.material.opacity = 0.85 * sample.envelope;
        loop.visible = true;
      });
    },
    dispose() {
      geometry.dispose();
      loops.forEach((loop) => loop.material.dispose());
    },
  };
}
