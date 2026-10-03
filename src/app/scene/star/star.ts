/**
 * Procedural star: photosphere, corona and prominence loops behind one handle.
 *
 * Mirrors `createGasGiant`: the caller places `group`, calls `advance(delta)`
 * each frame and `dispose()` when done. All parameters come from a
 * `StarProfile`, so every spectral class shares this one composition.
 */
import { Color, Group, Mesh, SphereGeometry, type ColorRepresentation, type ShaderMaterial } from 'three';
import type { StarProfile } from '../../model/star/star-profile';
import { createStarCorona, type StarCoronaHandle } from './star-corona';
import { STAR_DEFAULT_FLARE_ACTIVITY, StarFlareScheduler } from './star-flares';
import { createStarPhotosphereMaterial } from './star-photosphere-material';
import { createStarProminences, type StarProminenceHandle } from './star-prominences';

export interface CreateStarOptions {
  radius?: number;
  widthSegments?: number;
  heightSegments?: number;
  /** 0-100; 60 keeps the class's flare rate. */
  flareActivity?: number;
}

export interface StarUserData {
  bodyId: string;
  letter: string;
  subtype: number;
  luminosityClass: string;
  spectralClass: string;
}

export interface StarHandle {
  /** Root to place in the scene; holds the tilted, spinning star and its corona. */
  readonly group: Group;
  readonly photosphere: Mesh<SphereGeometry, ShaderMaterial>;
  readonly corona: StarCoronaHandle;
  readonly prominences: StarProminenceHandle;
  readonly flares: StarFlareScheduler;
  advance(delta: number): void;
  /** 0-100. */
  setFlareActivity(percent: number): void;
  /** Tints the star toward a pick colour, or clears it with null. */
  setHighlight(color: ColorRepresentation | null): void;
  dispose(): void;
}

/** Shader time wraps here so float precision does not degrade on long sessions. */
export const STAR_TIME_WRAP_SECONDS = 600;
const HIGHLIGHT_AMOUNT = 0.55;
const MAX_STEP_SECONDS = 0.05;

export function createStar(profile: StarProfile, options: CreateStarOptions = {}): StarHandle {
  const radius = options.radius ?? 1;
  const photosphereMaterial = createStarPhotosphereMaterial(profile);
  const corona = createStarCorona(profile, radius);
  const prominences = createStarProminences(profile, radius);
  const flares = new StarFlareScheduler(profile.seed, profile.flaresPerMinute);
  flares.setActivity(options.flareActivity ?? STAR_DEFAULT_FLARE_ACTIVITY);

  const group = new Group();
  group.name = 'star';
  group.userData['star'] = {
    bodyId: profile.bodyId,
    letter: profile.spectralClass.letter,
    subtype: profile.spectralClass.subtype,
    luminosityClass: profile.spectralClass.luminosityClass,
    spectralClass: profile.spectralClass.label,
  } satisfies StarUserData;

  const tilt = new Group();
  tilt.rotation.z = profile.axialTilt;
  group.add(tilt);
  const spin = new Group();
  tilt.add(spin);

  const photosphere = new Mesh(
    new SphereGeometry(radius, options.widthSegments ?? 64, options.heightSegments ?? 48),
    photosphereMaterial.material,
  );
  photosphere.name = 'star-photosphere';
  photosphere.raycast = () => undefined;
  spin.add(photosphere, prominences.group);
  group.add(corona.mesh);

  const spinRate = (Math.PI * 2) / Math.max(profile.rotationPeriodSeconds, 1);
  const photosphereUniforms = photosphereMaterial.uniforms;
  const highlight = new Color();

  return {
    group,
    photosphere,
    corona,
    prominences,
    flares,
    advance(delta: number): void {
      const step = Math.min(Math.max(delta, 0), MAX_STEP_SECONDS);
      spin.rotation.y = (spin.rotation.y + step * spinRate) % (Math.PI * 2);
      const time = (photosphereUniforms.uTime.value + step) % STAR_TIME_WRAP_SECONDS;
      photosphereUniforms.uTime.value = time;
      corona.uniforms.uTime.value = time;
      const samples = flares.advance(step);
      photosphereMaterial.setFlares(samples);
      prominences.update(samples);
    },
    setFlareActivity(percent: number): void {
      flares.setActivity(percent);
    },
    setHighlight(color: ColorRepresentation | null): void {
      if (color === null) {
        photosphereUniforms.uHighlightAmount.value = 0;
        return;
      }
      photosphereUniforms.uHighlightColor.value.copy(highlight.set(color).convertSRGBToLinear());
      photosphereUniforms.uHighlightAmount.value = HIGHLIGHT_AMOUNT;
    },
    dispose(): void {
      photosphere.geometry.dispose();
      photosphereMaterial.material.dispose();
      corona.dispose();
      prominences.dispose();
    },
  };
}
