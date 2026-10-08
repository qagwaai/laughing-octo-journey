import * as T from '/three/build/three.module.js';

const versions = { earth: 'earth-july-v2', luna: 'luna-v3', mars: 'mars-v2' };
const legacyVersions = { luna: 'luna-v2', mars: 'mars-v1' };
const canvas = document.querySelector('#canvas');
const status = document.querySelector('#status');
const renderer = new T.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.setSize(768, 512);
renderer.outputColorSpace = T.SRGBColorSpace;
renderer.toneMapping = T.NoToneMapping;
const scene = new T.Scene();
scene.background = new T.Color('#080808');
const camera = new T.PerspectiveCamera(35, 768 / 512, 0.1, 20);
const sphere = new T.Mesh(new T.SphereGeometry(1, 72, 72), new T.MeshStandardMaterial());
scene.add(sphere);
const ambient = new T.AmbientLight(0xffffff, 0.35);
const light = new T.DirectionalLight(0xffffff, 2.2);
light.position.set(-3, 2, 3);
scene.add(ambient, light);
const loader = new T.TextureLoader();
const cache = new Map();
const flatNormal = new T.DataTexture(new Uint8Array([128, 128, 255, 255]), 1, 1);
flatNormal.needsUpdate = true;
const manifests = {};
for (const [body, version] of Object.entries(versions)) {
  const response = await fetch(`/textures/${version}/derivative-manifest.json`);
  if (!response.ok) throw new Error(`Manifest ${body}: ${response.status}`);
  manifests[body] = await response.json();
}
const entries = await (await fetch('/landmarks/index.json')).json();
for (const item of entries) {
  const section = document.createElement('section');
  section.id = item.prefix;
  const heading = document.createElement('h3');
  heading.textContent = `${item.body}: ${item.name} | ${item.boundsDegrees.join(', ')} degrees`;
  section.append(heading);
  const row = document.createElement('div');
  row.className = 'row';
  for (const suffix of ['color', 'hillshade', 'overlay']) {
    const image = document.createElement('img');
    image.src = `/landmarks/${item.prefix}-${suffix}.png`;
    image.alt = `${item.body} ${item.name} ${suffix}`;
    row.append(image);
  }
  section.append(row);
  document.querySelector('#landmarks').append(section);
}

async function texture(body, tier, kind, version = versions[body]) {
  const prefix = body === 'earth' ? 'earth-july' : body;
  const name = `${prefix}-${tier}-${kind}.${kind === 'albedo' ? 'jpg' : 'png'}`;
  const key = `${version}/${name}`;
  if (cache.has(key)) return cache.get(key);
  const loaded = await loader.loadAsync(`/textures/${version}/${name}`);
  loaded.colorSpace = kind === 'albedo' ? T.SRGBColorSpace : T.NoColorSpace;
  loaded.wrapS = T.RepeatWrapping;
  loaded.wrapT = T.ClampToEdgeWrapping;
  loaded.generateMipmaps = true;
  loaded.minFilter = T.LinearMipmapLinearFilter;
  loaded.magFilter = T.LinearFilter;
  loaded.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
  loaded.needsUpdate = true;
  cache.set(key, loaded);
  return loaded;
}

function location(longitude, latitude) {
  const phi = ((longitude + 180) * Math.PI) / 180;
  const lat = (latitude * Math.PI) / 180;
  return new T.Vector3(-Math.cos(phi) * Math.cos(lat), Math.sin(lat), Math.sin(phi) * Math.cos(lat));
}

async function render(options = {}) {
  const body = options.body ?? document.querySelector('#body').value;
  const tier = options.tier ?? document.querySelector('#tier').value;
  const view = options.view ?? document.querySelector('#view').value;
  const mode = options.mode ?? document.querySelector('#mode').value;
  const albedo = await texture(body, tier, 'albedo');
  const variant = options.variant ?? 'selected';
  assert(['selected', 'baseline', 'geodesic', 'transition'].includes(variant), 'Unknown normal experiment');
  let normal =
    tier === 'preview'
      ? null
      : await texture(
          body,
          tier,
          'normal',
          variant === 'baseline' ? (legacyVersions[body] ?? versions[body]) : versions[body],
        );
  if (variant === 'geodesic' || variant === 'transition') {
    assert(['luna', 'mars'].includes(body) && tier !== 'preview', 'Experiment has no matching map');
    const key = `${body}/${tier}/${variant}`;
    if (!cache.has(key)) {
      const map = await loader.loadAsync(`/experiments/${body}-${tier}-${variant}-normal.png`);
      map.colorSpace = T.NoColorSpace;
      map.wrapS = T.RepeatWrapping;
      map.wrapT = T.ClampToEdgeWrapping;
      cache.set(key, map);
    }
    normal = cache.get(key);
  }
  const filtering = options.filtering ?? 'mipmapped';
  assert(['mipmapped', 'nearest'].includes(filtering), 'Unknown diagnostic filtering');
  for (const map of [albedo, normal].filter(Boolean)) {
    map.minFilter = filtering === 'nearest' ? T.NearestFilter : T.LinearMipmapLinearFilter;
    map.magFilter = filtering === 'nearest' ? T.NearestFilter : T.LinearFilter;
    map.anisotropy = filtering === 'nearest' ? 1 : Math.min(4, renderer.capabilities.getMaxAnisotropy());
    map.needsUpdate = true;
  }
  const segments = options.segments ?? 72;
  if (sphere.geometry.parameters.widthSegments !== segments) {
    sphere.geometry.dispose();
    sphere.geometry = new T.SphereGeometry(1, segments, segments);
  }
  const old = sphere.material;
  sphere.material =
    mode === 'albedo'
      ? new T.MeshBasicMaterial({ map: albedo })
      : new T.MeshStandardMaterial({
          map: ['gray-relief', 'gray', 'flat-normal'].includes(mode) ? null : albedo,
          normalMap: mode === 'gray' ? null : mode === 'flat-normal' ? flatNormal : normal,
          color: mode === 'viewer-tint' ? '#f2f8ff' : '#ffffff',
          roughness: 0.72,
          metalness: 0,
          emissive: mode === 'viewer-tint' ? '#1a2638' : '#000000',
          emissiveIntensity: mode === 'viewer-tint' ? 0.18 : 0,
        });
  old.dispose();
  const positions = { front: [0, 0], seam: [180, 0], north: [0, 88], south: [0, -88] };
  const [longitude, latitude] = options.coordinates ?? positions[view];
  camera.position.copy(location(longitude, latitude).multiplyScalar(3.5));
  camera.fov = options.fov ?? 35;
  assert(camera.fov > 0 && camera.fov < 180, 'Invalid diagnostic field of view');
  camera.updateProjectionMatrix();
  camera.up.set(...(Math.abs(latitude) === 90 ? [0, 0, -1] : [0, 1, 0]));
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld(true);
  const right = new T.Vector3().setFromMatrixColumn(camera.matrix, 0);
  const up = new T.Vector3().setFromMatrixColumn(camera.matrix, 1);
  light.position.copy(camera.position).addScaledVector(right, -2).addScaledVector(up, 2);
  renderer.render(scene, camera);
  const ray = new T.Raycaster();
  ray.setFromCamera(new T.Vector2(0, 0), camera);
  const center = ray.intersectObject(sphere)[0];
  assert(center?.uv, 'Camera did not intersect the diagnostic sphere');
  const result = {
    body,
    tier,
    view,
    mode,
    variant,
    filtering,
    segments,
    fov: camera.fov,
    colorSpace: albedo.colorSpace,
    normalColorSpace: normal?.colorSpace,
    flipY: albedo.flipY,
    dimensions: [albedo.image.width, albedo.image.height],
    normalDimensions: normal ? [normal.image.width, normal.image.height] : null,
    drawCalls: renderer.info.render.calls,
    triangles: renderer.info.render.triangles,
    textureCount: renderer.info.memory.textures,
    cameraCoordinates: [longitude, latitude],
    centerUv: center.uv.toArray(),
  };
  status.textContent = JSON.stringify(result, null, 2);
  return result;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
function pixel(image, x, y) {
  const copy = document.createElement('canvas');
  copy.width = image.width;
  copy.height = image.height;
  const context = copy.getContext('2d', { willReadFrequently: true });
  context.drawImage(image, 0, 0);
  return Array.from(context.getImageData(x, y, 1, 1).data).slice(0, 3);
}
function linear(byte) {
  const v = byte / 255;
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
}

function gpuSample(map, u, v) {
  const target = new T.WebGLRenderTarget(1, 1, { depthBuffer: false });
  target.texture.colorSpace = T.NoColorSpace;
  const material = new T.RawShaderMaterial({
    uniforms: { map: { value: map }, point: { value: new T.Vector2(u, v) } },
    vertexShader: 'precision highp float; attribute vec3 position; void main(){ gl_Position=vec4(position.xy,0.,1.); }',
    fragmentShader:
      'precision highp float; uniform sampler2D map; uniform vec2 point; void main(){ gl_FragColor=texture2D(map,point); }',
  });
  const mesh = new T.Mesh(new T.PlaneGeometry(2, 2), material);
  const sampleScene = new T.Scene();
  sampleScene.add(mesh);
  renderer.setRenderTarget(target);
  renderer.render(sampleScene, new T.Camera());
  const bytes = new Uint8Array(4);
  renderer.readRenderTargetPixels(target, 0, 0, 1, 1, bytes);
  renderer.setRenderTarget(null);
  material.dispose();
  mesh.geometry.dispose();
  target.dispose();
  return Array.from(bytes).slice(0, 3);
}

function planeLuminance(normalBytes, lightX, lightY = 0) {
  const map = new T.DataTexture(new Uint8Array([...normalBytes, 255]), 1, 1);
  map.needsUpdate = true;
  const material = new T.MeshStandardMaterial({ color: '#ffffff', normalMap: map, roughness: 1 });
  const mesh = new T.Mesh(new T.PlaneGeometry(2, 2), material);
  const testScene = new T.Scene();
  testScene.add(mesh);
  const lamp = new T.DirectionalLight(0xffffff, 2);
  lamp.position.set(lightX, lightY, 1);
  testScene.add(lamp);
  const target = new T.WebGLRenderTarget(3, 3);
  const testCamera = new T.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
  testCamera.position.z = 3;
  renderer.setRenderTarget(target);
  renderer.render(testScene, testCamera);
  const bytes = new Uint8Array(4);
  renderer.readRenderTargetPixels(target, 1, 1, 1, 1, bytes);
  renderer.setRenderTarget(null);
  target.dispose();
  material.dispose();
  mesh.geometry.dispose();
  map.dispose();
  return bytes[0];
}

async function run() {
  const results = [];
  const gl = renderer.getContext();
  for (const body of Object.keys(versions)) {
    for (const tier of ['preview', 'low', 'standard']) {
      const albedo = await texture(body, tier, 'albedo');
      assert(albedo.flipY && albedo.colorSpace === T.SRGBColorSpace, 'Albedo upload policy');
      const sets = [{ kind: 'albedo', map: albedo }];
      if (tier !== 'preview') sets.push({ kind: 'normal', map: await texture(body, tier, 'normal') });
      for (const { kind, map } of sets) {
        const width = map.image.width,
          height = map.image.height;
        assert(
          width <= renderer.capabilities.maxTextureSize && height <= renderer.capabilities.maxTextureSize,
          'MAX_TEXTURE_SIZE',
        );
        const errors = [];
        for (const [x, y] of [
          [width / 2, height / 2],
          [1, 1],
          [width - 2, height - 2],
        ]) {
          const source = pixel(map.image, x, y);
          const actual = gpuSample(map, (x + 0.5) / width, 1 - (y + 0.5) / height);
          const expected = kind === 'albedo' ? source.map((value) => Math.round(linear(value) * 255)) : source;
          const error = Math.max(...actual.map((value, index) => Math.abs(value - expected[index])));
          assert(error <= 2, `${body}/${tier}/${kind} GPU sample error ${error}`);
          errors.push(error);
        }
        results.push({ body, tier, kind, gpuLinearSampleMaxByteError: Math.max(...errors), flipY: map.flipY });
      }
      for (const view of ['front', 'seam', 'north', 'south']) {
        const rendered = await render({ body, tier, view, mode: tier === 'preview' ? 'albedo' : 'relief' });
        const [longitude, latitude] = rendered.cameraCoordinates;
        const expectedU = (longitude + 180) / 360;
        const differenceU = Math.abs(rendered.centerUv[0] - expectedU);
        assert(Math.min(differenceU, Math.abs(1 - differenceU)) < 0.02, 'Sphere longitude/UV mapping');
        assert(Math.abs(rendered.centerUv[1] - (latitude + 90) / 180) < 0.005, 'Sphere latitude/UV mapping');
        assert(gl.getError() === gl.NO_ERROR, `${body}/${tier}/${view} GL error`);
      }
    }
  }
  const positive = planeLuminance([218, 128, 218], 2);
  const negative = planeLuminance([218, 128, 218], -2);
  assert(positive > negative + 20, 'MeshStandardMaterial normal red direction incorrect');
  const flatA = planeLuminance([128, 128, 255], 2);
  const flatB = planeLuminance([128, 128, 255], -2);
  assert(Math.abs(flatA - flatB) <= 2, 'Quantized neutral map biases flat lighting');
  const north = planeLuminance([128, 218, 218], 0, 2);
  const south = planeLuminance([128, 218, 218], 0, -2);
  assert(north > south + 20, 'MeshStandardMaterial normal green direction incorrect');
  const waterSamples = [];
  for (const tier of ['low', 'standard']) {
    const map = await texture('earth', tier, 'normal');
    for (const [longitude, latitude] of [
      [-140, 0],
      [-30, 0],
      [70, -30],
    ]) {
      const bytes = gpuSample(map, (longitude + 180) / 360, (latitude + 90) / 180);
      assert(
        bytes.every((value, index) => Math.abs(value - [128, 128, 255][index]) <= 1),
        'Earth ocean normal changed during GPU upload/filtering',
      );
      waterSamples.push({ tier, longitude, latitude, bytes });
    }
  }
  sphere.material.map = null;
  sphere.material.normalMap = null;
  sphere.material.needsUpdate = true;
  for (const map of cache.values()) map.dispose();
  cache.clear();
  renderer.render(scene, camera);
  const baseline = renderer.info.memory.textures;
  const cycles = [];
  for (let index = 0; index < 3; index++) {
    await render({ body: 'mars', tier: 'low', view: 'front', mode: 'relief' });
    sphere.material.map = null;
    sphere.material.normalMap = null;
    sphere.material.needsUpdate = true;
    for (const map of cache.values()) map.dispose();
    cache.clear();
    renderer.render(scene, camera);
    cycles.push(renderer.info.memory.textures);
    assert(renderer.info.memory.textures === baseline, 'Owned texture count grew after dispose');
  }
  const report = {
    status: 'passed',
    threeRevision: T.REVISION,
    webglVersion: gl.getParameter(gl.VERSION),
    maxTextureSize: renderer.capabilities.maxTextureSize,
    viewport: [768, 512],
    dpr: 1,
    samples: results,
    renderCases: 36,
    materialNormalRedResponse: { positive, negative, flatA, flatB },
    materialNormalGreenResponse: { north, south },
    earthOceanGpuSamples: waterSamples,
    disposedTextureBaseline: baseline,
    repeatedLoadDisposeCounts: cycles,
    limitations: [
      'Isolated harness, not Angular Viewer',
      'No timing/hardware performance claim',
      'Rendered seam/pole cases require visual assessment',
      'Fine source alignment not established by GPU samples',
    ],
  };
  await render({ body: 'earth', tier: 'standard', view: 'front', mode: 'albedo' });
  status.textContent = JSON.stringify(report, null, 2);
  return report;
}
document.querySelector('#render').onclick = () =>
  render().catch((error) => {
    status.textContent = error.stack;
    console.error(error);
  });
document.querySelector('#run').onclick = () =>
  run().catch((error) => {
    status.textContent = error.stack;
    console.error(error);
  });
window.diagnostics = { render, run, renderer, entries };
await render();
