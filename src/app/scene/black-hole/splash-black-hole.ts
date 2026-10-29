import { AdditiveBlending, Euler, Matrix4, Mesh, PlaneGeometry, Quaternion, ShaderMaterial, Vector3 } from 'three';
import { deriveStarProfile } from '../../model/star/star-profile';
import { SPLASH_CAMERA_DIRECTION } from '../splash-composition';
import type { SplashQuality } from '../splash-state';
import { createStar } from '../star/star';
import { createBlackHole } from './black-hole';

import { BLACK_HOLE_SPLASH_QUALITY } from '../../model/black-hole/cygnus-x1';

export function createSplashBlackHole(quality: SplashQuality) {
  const sceneView = new Quaternion().setFromRotationMatrix(
    new Matrix4().lookAt(SPLASH_CAMERA_DIRECTION, new Vector3(), new Vector3(0, 1, 0)),
  );
  const viewRotation = new Quaternion()
    .setFromEuler(new Euler(-Math.atan(0.25), 0, -0.35))
    .multiply(sceneView.clone().invert());
  const hole = createBlackHole({ ...BLACK_HOLE_SPLASH_QUALITY[quality], viewRotation });
  const companion = createStar(deriveStarProfile('cygnus-x1-companion', 'O9I', { surfaceArchetype: 'star' }), {
    radius: 0.36,
    widthSegments: 48,
    heightSegments: 32,
    flareActivity: 0,
  });
  companion.group.name = 'cygnus-x1-companion';
  // An authored off-axis portrait, not a star at infinity behind the lens or a binary-scale diagram.
  companion.group.position.set(-4.1, 2.7, 0.7).applyQuaternion(sceneView);
  // Composite this authored portrait after the lens image, regardless of camera-side depth.
  companion.photosphere.material.transparent = true;
  companion.photosphere.material.depthTest = false;
  companion.photosphere.material.depthWrite = false;
  companion.photosphere.renderOrder = 1;
  hole.group.add(companion.group);
  const windMaterial = new ShaderMaterial({
    uniforms: { uTime: { value: 0 } },
    defines: { WISP_COUNT: quality === 'low' ? 7 : 12 },
    vertexShader: `
      varying vec2 vPosition;
      void main() {
        vPosition = position.xy;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uTime;
      varying vec2 vPosition;
      void main() {
        float radius = length(vPosition);
        float angle = atan(vPosition.y, vPosition.x);
        float wisps = 0.0;
        for (int i = 0; i < WISP_COUNT; i++) {
          float seed = float(i) * 2.399963;
          float direction = seed + 0.09 * sin(radius * 8.0 + seed);
          float angularDistance = atan(sin(angle - direction), cos(angle - direction));
          float filament = exp(-pow(angularDistance / (0.045 + 0.025 * sin(seed)), 2.0));
          float travel = fract(radius * 1.4 - uTime * 0.055 + float(i) * 0.618034);
          float packet = pow(sin(travel * 3.141593), 6.0);
          wisps += filament * packet * (0.65 + 0.35 * sin(seed * 3.0));
        }
        float envelope = smoothstep(0.37, 0.48, radius) * (1.0 - smoothstep(0.55, 1.08, radius));
        gl_FragColor = vec4(vec3(0.45, 0.70, 1.0), min(wisps, 1.0) * envelope * 0.09);
        #include <colorspace_fragment>
      }
    `,
    transparent: true,
    blending: AdditiveBlending,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
  });
  const wind = new Mesh(new PlaneGeometry(2.2, 2.2), windMaterial);
  wind.name = 'cygnus-x1-stellar-wind';
  wind.position.copy(companion.group.position);
  wind.visible = false;
  wind.renderOrder = 2;
  wind.raycast = () => undefined;
  hole.group.add(wind);
  const cameraRotation = new Quaternion();
  const inverseRotation = new Quaternion();
  let disposed = false;
  return {
    ...hole,
    setWindEnabled(enabled: boolean) {
      wind.visible = enabled;
    },
    advance(delta: number) {
      hole.advance(delta);
      companion.advance(delta);
      // Match the bounded animation clock; reduced motion is gated by the scene.
      windMaterial.uniforms['uTime'].value = (windMaterial.uniforms['uTime'].value + Math.min(delta, 0.05)) % 600;
    },
    render(renderer: Parameters<typeof hole.render>[0], camera: Parameters<typeof hole.render>[1]) {
      hole.render(renderer, camera);
      hole.group.getWorldQuaternion(inverseRotation).invert();
      camera.getWorldQuaternion(cameraRotation);
      wind.quaternion.copy(inverseRotation).multiply(cameraRotation);
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      wind.removeFromParent();
      wind.geometry.dispose();
      windMaterial.dispose();
      companion.group.removeFromParent();
      companion.dispose();
      hole.dispose();
    },
  };
}

export type SplashBlackHoleHandle = ReturnType<typeof createSplashBlackHole>;
