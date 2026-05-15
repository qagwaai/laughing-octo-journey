/**
 * Headless Node.js script that builds the Scavenger Pod mesh from procedural
 * Three.js geometry (mirroring app-viewer-scavenger-pod-mesh) and exports it
 * as a binary GLB file to public/models/ships/scavenger-pod.glb.
 *
 * Run from workspace root:
 *   node scripts/export-scavenger-pod-glb.mjs
 */

// ---------------------------------------------------------------------------
// Node.js polyfills required by Three.js GLTFExporter (no DOM environment)
// ---------------------------------------------------------------------------
if (typeof globalThis.FileReader === 'undefined') {
  globalThis.FileReader = class {
    readAsArrayBuffer(blob) {
      blob.arrayBuffer().then((ab) => {
        this.result = ab;
        this.onloadend?.();
      }).catch((err) => this.onerror?.(err));
    }

    readAsDataURL(blob) {
      blob.arrayBuffer().then((ab) => {
        const b64 = Buffer.from(ab).toString('base64');
        this.result = `data:application/octet-stream;base64,${b64}`;
        this.onloadend?.();
      }).catch((err) => this.onerror?.(err));
    }
  };
}

import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { writeFileSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_PATH = resolve(__dirname, '../public/models/ships/scavenger-pod.glb');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function stdMat(opts) {
  return new THREE.MeshStandardMaterial({
    color: opts.color ?? '#ffffff',
    roughness: opts.roughness ?? 0.5,
    metalness: opts.metalness ?? 0.3,
    transparent: opts.transparent ?? false,
    opacity: opts.opacity ?? 1.0,
    emissive: new THREE.Color(opts.emissive ?? '#000000'),
    emissiveIntensity: opts.emissiveIntensity ?? 0,
  });
}

function mesh(name, geometry, material, pos, rot) {
  const m = new THREE.Mesh(geometry, material);
  m.name = name;
  if (pos) m.position.set(...pos);
  if (rot) m.rotation.set(...rot);
  return m;
}

function group(name, pos, rot) {
  const g = new THREE.Group();
  g.name = name;
  if (pos) g.position.set(...pos);
  if (rot) g.rotation.set(...rot);
  return g;
}

// ---------------------------------------------------------------------------
// Default hull color — matches the Angular template default input '#3b82f6'
// ---------------------------------------------------------------------------
const HULL_COLOR = '#3b82f6';

// ---------------------------------------------------------------------------
// Root group — mirrors [rotation]="[0, 0.18, 0]" on the Angular template root
// (scale is intentionally NOT baked in; callers apply [scale]="0.1")
// ---------------------------------------------------------------------------
const root = group('scavenger-pod', [0, 0, 0], [0, 0.18, 0]);

// Hull core
root.add(
  mesh(
    'pod-hull-core',
    new THREE.BoxGeometry(0.72, 0.42, 1.08),
    stdMat({ color: HULL_COLOR, roughness: 0.54, metalness: 0.36, emissive: '#1e3a5f', emissiveIntensity: 0.4 }),
    [0, 0, 0.12],
  ),
);

// Hull shoulder
root.add(
  mesh(
    'pod-hull-shoulder',
    new THREE.BoxGeometry(0.54, 0.12, 0.82),
    stdMat({ color: '#334154', roughness: 0.6, metalness: 0.32 }),
    [0, 0.21, 0.08],
    [-0.18, 0, 0],
  ),
);

// Nose upper
root.add(
  mesh(
    'pod-nose-upper',
    new THREE.BoxGeometry(0.52, 0.18, 0.48),
    stdMat({ color: HULL_COLOR, roughness: 0.52, metalness: 0.34, emissive: '#1e3a5f', emissiveIntensity: 0.26 }),
    [0, 0.09, -0.5],
    [0.54, 0, 0],
  ),
);

// Nose lower
root.add(
  mesh(
    'pod-nose-lower',
    new THREE.BoxGeometry(0.56, 0.14, 0.44),
    stdMat({ color: '#273241', roughness: 0.68, metalness: 0.22 }),
    [0, -0.08, -0.5],
    [-0.32, 0, 0],
  ),
);

// Cockpit glass
root.add(
  mesh(
    'pod-cockpit-glass',
    new THREE.BoxGeometry(0.34, 0.13, 0.34),
    stdMat({ color: '#8bd6ff', transparent: true, opacity: 0.46, roughness: 0.08, metalness: 0.18, emissive: '#24465f', emissiveIntensity: 0.12 }),
    [0, 0.16, -0.48],
    [0.7, 0, 0],
  ),
);

// Cockpit frame
root.add(
  mesh(
    'pod-cockpit-frame-top',
    new THREE.BoxGeometry(0.38, 0.03, 0.24),
    stdMat({ color: '#192430', roughness: 0.56, metalness: 0.42 }),
    [0, 0.26, -0.46],
    [0.5, 0, 0],
  ),
);
root.add(
  mesh(
    'pod-cockpit-frame-left',
    new THREE.BoxGeometry(0.03, 0.22, 0.24),
    stdMat({ color: '#192430', roughness: 0.56, metalness: 0.42 }),
    [-0.19, 0.11, -0.47],
    [0.48, 0.08, -0.3],
  ),
);
root.add(
  mesh(
    'pod-cockpit-frame-right',
    new THREE.BoxGeometry(0.03, 0.22, 0.24),
    stdMat({ color: '#192430', roughness: 0.56, metalness: 0.42 }),
    [0.19, 0.11, -0.47],
    [0.48, -0.08, 0.3],
  ),
);

// Sensor array
root.add(
  mesh(
    'pod-sensor-array',
    new THREE.BoxGeometry(0.22, 0.05, 0.26),
    stdMat({ color: '#4d637a', roughness: 0.45, metalness: 0.52, emissive: '#112434', emissiveIntensity: 0.15 }),
    [0, 0.31, -0.03],
  ),
);

// Side bays
root.add(
  mesh(
    'pod-side-bay-left',
    new THREE.BoxGeometry(0.1, 0.18, 0.26),
    stdMat({ color: '#253142', roughness: 0.62, metalness: 0.26 }),
    [-0.36, -0.06, 0.06],
  ),
);
root.add(
  mesh(
    'pod-side-bay-right',
    new THREE.BoxGeometry(0.1, 0.18, 0.26),
    stdMat({ color: '#253142', roughness: 0.62, metalness: 0.26 }),
    [0.36, -0.06, 0.06],
  ),
);

// Service panels
root.add(
  mesh(
    'pod-service-panel-left',
    new THREE.BoxGeometry(0.02, 0.18, 0.18),
    stdMat({ color: '#7ca7c2', roughness: 0.35, metalness: 0.58 }),
    [-0.31, 0.02, 0.14],
  ),
);
root.add(
  mesh(
    'pod-service-panel-right',
    new THREE.BoxGeometry(0.02, 0.18, 0.18),
    stdMat({ color: '#7ca7c2', roughness: 0.35, metalness: 0.58 }),
    [0.31, 0.02, 0.14],
  ),
);

// Engine bodies
root.add(
  mesh(
    'pod-engine-body-upper',
    new THREE.CylinderGeometry(0.14, 0.14, 0.22, 20),
    stdMat({ color: '#516173', roughness: 0.5, metalness: 0.44 }),
    [0, 0.06, 0.78],
    [Math.PI / 2, 0, 0],
  ),
);
root.add(
  mesh(
    'pod-engine-body-lower',
    new THREE.CylinderGeometry(0.12, 0.12, 0.18, 20),
    stdMat({ color: '#516173', roughness: 0.5, metalness: 0.44 }),
    [0, -0.13, 0.8],
    [Math.PI / 2, 0, 0],
  ),
);

// Thruster cones
root.add(
  mesh(
    'pod-thruster-upper',
    new THREE.ConeGeometry(0.12, 0.24, 20),
    stdMat({ color: '#9aa5b7', roughness: 0.34, metalness: 0.6, emissive: '#0f2d48', emissiveIntensity: 0.08 }),
    [0, 0.06, 1.01],
    [-Math.PI / 2, 0, 0],
  ),
);
root.add(
  mesh(
    'pod-thruster-lower',
    new THREE.ConeGeometry(0.1, 0.2, 20),
    stdMat({ color: '#9aa5b7', roughness: 0.34, metalness: 0.6, emissive: '#0f2d48', emissiveIntensity: 0.06 }),
    [0, -0.16, 0.99],
    [-Math.PI / 2, 0, 0],
  ),
);

// Left arm
const armLeft = group('pod-arm-left', [-0.29, -0.02, -0.42], [0.08, 0.3, -0.28]);
armLeft.add(mesh('pod-arm-left-primary', new THREE.BoxGeometry(0.12, 0.05, 0.42), stdMat({ color: '#6e7e90', roughness: 0.45, metalness: 0.5 }), [-0.16, 0, -0.16]));
armLeft.add(mesh('pod-arm-left-joint', new THREE.CylinderGeometry(0.045, 0.045, 0.08, 16), stdMat({ color: '#465667', roughness: 0.4, metalness: 0.62 }), [-0.26, 0, -0.39], [Math.PI / 2, 0, 0]));
armLeft.add(mesh('pod-arm-left-fore', new THREE.BoxGeometry(0.08, 0.045, 0.24), stdMat({ color: '#6e7e90', roughness: 0.45, metalness: 0.5 }), [-0.34, 0, -0.52], [0.18, 0, -0.08]));
armLeft.add(mesh('pod-arm-left-claw-upper', new THREE.BoxGeometry(0.035, 0.12, 0.035), stdMat({ color: '#8fa0b4', roughness: 0.38, metalness: 0.58 }), [-0.37, 0.04, -0.66], [0, 0, 0.48]));
armLeft.add(mesh('pod-arm-left-claw-lower', new THREE.BoxGeometry(0.035, 0.12, 0.035), stdMat({ color: '#8fa0b4', roughness: 0.38, metalness: 0.58 }), [-0.37, -0.04, -0.66], [0, 0, -0.48]));
root.add(armLeft);

// Right arm
const armRight = group('pod-arm-right', [0.29, -0.02, -0.42], [0.08, -0.3, 0.28]);
armRight.add(mesh('pod-arm-right-primary', new THREE.BoxGeometry(0.12, 0.05, 0.42), stdMat({ color: '#6e7e90', roughness: 0.45, metalness: 0.5 }), [0.16, 0, -0.16]));
armRight.add(mesh('pod-arm-right-joint', new THREE.CylinderGeometry(0.045, 0.045, 0.08, 16), stdMat({ color: '#465667', roughness: 0.4, metalness: 0.62 }), [0.26, 0, -0.39], [Math.PI / 2, 0, 0]));
armRight.add(mesh('pod-arm-right-fore', new THREE.BoxGeometry(0.08, 0.045, 0.24), stdMat({ color: '#6e7e90', roughness: 0.45, metalness: 0.5 }), [0.34, 0, -0.52], [0.18, 0, 0.08]));
armRight.add(mesh('pod-arm-right-claw-upper', new THREE.BoxGeometry(0.035, 0.12, 0.035), stdMat({ color: '#8fa0b4', roughness: 0.38, metalness: 0.58 }), [0.37, 0.04, -0.66], [0, 0, -0.48]));
armRight.add(mesh('pod-arm-right-claw-lower', new THREE.BoxGeometry(0.035, 0.12, 0.035), stdMat({ color: '#8fa0b4', roughness: 0.38, metalness: 0.58 }), [0.37, -0.04, -0.66], [0, 0, 0.48]));
root.add(armRight);

// Chin tool
const chinTool = group('pod-chin-tool', [0, -0.13, -0.5], [-0.1, 0, 0]);
chinTool.add(mesh('pod-chin-tool-shaft', new THREE.BoxGeometry(0.06, 0.04, 0.34), stdMat({ color: '#6b7c90', roughness: 0.42, metalness: 0.52 }), [0, -0.02, -0.15]));
chinTool.add(mesh('pod-chin-tool-head', new THREE.CylinderGeometry(0.05, 0.05, 0.08, 16), stdMat({ color: '#445264', roughness: 0.42, metalness: 0.56 }), [0, -0.02, -0.37], [Math.PI / 2, 0, 0]));
root.add(chinTool);

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

mkdirSync(resolve(__dirname, '../public/models/ships'), { recursive: true });

const exporter = new GLTFExporter();
const result = await exporter.parseAsync(root, { binary: true });

if (!(result instanceof ArrayBuffer)) {
  console.error('Expected ArrayBuffer from binary export');
  process.exit(1);
}

writeFileSync(OUTPUT_PATH, Buffer.from(result));
console.log(`✓ Exported ${OUTPUT_PATH} (${(result.byteLength / 1024).toFixed(1)} KB)`);
