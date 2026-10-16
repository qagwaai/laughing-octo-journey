import { expect, test } from '@playwright/test';
import { derivePlanetClimate, type PlanetArchetype } from '../../src/app/model/planet/planet-seed';
import { rasterizePlanet, sampleAlbedoAt, sampleMaterialAt } from '../../src/app/model/planet/planet-texture';
import {
  buildPlanetShaderUniforms,
  PLANET_BAKE_MODE_ALBEDO,
  PLANET_BAKE_MODE_MATERIAL,
  PLANET_BAKE_MODE_NORMAL,
  PLANET_FRAGMENT_SHADER,
  PLANET_SHADER_VERSION_DIRECTIVE,
  PLANET_VERTEX_SHADER,
} from '../../src/app/scene/planet/planet-shader';

/**
 * Binds the GLSL mirror to the canonical CPU reference.
 *
 * The CPU implementation in src/app/model/planet/ is the source of truth. This
 * test renders the same shader the bake service uses through raw WebGL2 and
 * compares it against that reference. Without it the two implementations would
 * silently drift apart.
 *
 * Exact equality is impossible: the GPU computes in float32 while the CPU uses
 * float64, and trigonometry differs between them. Pixels sitting on a hard
 * threshold such as the sea-level boundary can therefore flip to a very
 * different colour from a tiny elevation difference.
 *
 * Observed agreement is close to exact (mean error ~0.06/255, ~2 outlier pixels
 * in 8192) because noise lattice values use only the top 16 bits of the hash
 * and so are bit-identical in float32 and float64. The limits below keep roughly
 * an order of magnitude of headroom for driver and rasteriser differences while
 * staying tight enough to catch genuine algorithmic drift, which would show up
 * as errors in the tens.
 */

const WIDTH = 128;
const HEIGHT = 64;
const MEAN_ERROR_LIMIT = 1;
const OUTLIER_CHANNEL_DELTA = 24;
const OUTLIER_FRACTION_LIMIT = 0.005;

interface BakeRequest {
  vertexShader: string;
  fragmentShader: string;
  uniforms: Record<string, number | readonly number[]>;
  width: number;
  height: number;
}

async function bakeOnGpu(page: import('@playwright/test').Page, request: BakeRequest): Promise<number[]> {
  return page.evaluate((input: BakeRequest) => {
    const canvas = document.createElement('canvas');
    canvas.width = input.width;
    canvas.height = input.height;

    const gl = canvas.getContext('webgl2', { antialias: false, preserveDrawingBuffer: true });
    if (!gl) throw new Error('WebGL2 is unavailable in this browser context.');

    const compile = (type: number, source: string): WebGLShader => {
      const shader = gl.createShader(type);
      if (!shader) throw new Error('Could not create shader.');
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        throw new Error(`Shader compilation failed: ${gl.getShaderInfoLog(shader)}`);
      }
      return shader;
    };

    const program = gl.createProgram();
    if (!program) throw new Error('Could not create program.');
    gl.attachShader(program, compile(gl.VERTEX_SHADER, input.vertexShader));
    gl.attachShader(program, compile(gl.FRAGMENT_SHADER, input.fragmentShader));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error(`Program link failed: ${gl.getProgramInfoLog(program)}`);
    }
    gl.useProgram(program);

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), gl.STATIC_DRAW);
    const positionLocation = gl.getAttribLocation(program, 'position');
    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 3, gl.FLOAT, false, 0, 0);

    for (const [name, value] of Object.entries(input.uniforms)) {
      const location = gl.getUniformLocation(program, name);
      if (!location) continue;
      if (Array.isArray(value)) {
        gl.uniform2f(location, value[0], value[1]);
      } else if (name === 'uMode') {
        gl.uniform1i(location, value as number);
      } else {
        gl.uniform1f(location, value as number);
      }
    }

    gl.viewport(0, 0, input.width, input.height);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    const pixels = new Uint8Array(input.width * input.height * 4);
    gl.readPixels(0, 0, input.width, input.height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
    return Array.from(pixels);
  }, request);
}

function requestFor(
  bodyId: string,
  mode: number = PLANET_BAKE_MODE_ALBEDO,
  archetype: PlanetArchetype = 'terran',
): BakeRequest {
  const climate = derivePlanetClimate(bodyId, archetype);
  const uniforms = buildPlanetShaderUniforms(climate, mode, WIDTH, HEIGHT);

  return {
    vertexShader: PLANET_SHADER_VERSION_DIRECTIVE + PLANET_VERTEX_SHADER,
    fragmentShader: PLANET_SHADER_VERSION_DIRECTIVE + PLANET_FRAGMENT_SHADER,
    uniforms: { ...uniforms, uTexel: [uniforms.uTexel[0], uniforms.uTexel[1]] },
    width: WIDTH,
    height: HEIGHT,
  };
}

test.describe('procedural planet GPU/CPU parity', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('about:blank');
  });

  for (const archetype of ['icy-moon', 'rocky-moon'] as const) {
    for (const mode of [PLANET_BAKE_MODE_ALBEDO, PLANET_BAKE_MODE_NORMAL, PLANET_BAKE_MODE_MATERIAL]) {
      test(`${archetype} GPU bake matches CPU terrain (mode ${mode})`, async ({ page }) => {
        const bodyId = `${archetype}-parity`;
        const climate = derivePlanetClimate(bodyId, archetype);
        const raster = rasterizePlanet(climate, {
          width: WIDTH,
          height: HEIGHT,
          includeNormal: true,
          includeMaterial: true,
          normalScale: 1,
        });
        const expected =
          mode === PLANET_BAKE_MODE_NORMAL
            ? raster.normal
            : mode === PLANET_BAKE_MODE_MATERIAL
              ? raster.material
              : raster.albedo;
        if (!expected) throw new Error(`Expected ${archetype} reference map`);
        const pixels = await bakeOnGpu(page, requestFor(bodyId, mode, archetype));
        let error = 0;
        let outliers = 0;
        let channels = 0;
        // The CPU uses edge texels at the poles; the GPU samples the exact pole.
        for (let row = 1; row < HEIGHT - 1; row += 1) {
          for (let column = 0; column < WIDTH; column += 1) {
            let worst = 0;
            for (let channel = 0; channel < 3; channel += 1) {
              const actualOffset = (row * WIDTH + column) * 4 + channel;
              const expectedOffset = ((HEIGHT - 1 - row) * WIDTH + column) * 4 + channel;
              const delta = Math.abs(pixels[actualOffset] - expected[expectedOffset]);
              error += delta;
              channels += 1;
              worst = Math.max(worst, delta);
            }
            if (worst > OUTLIER_CHANNEL_DELTA) outliers += 1;
          }
        }
        expect(error / channels).toBeLessThan(MEAN_ERROR_LIMIT);
        expect(outliers / (WIDTH * (HEIGHT - 2))).toBeLessThan(OUTLIER_FRACTION_LIMIT);
      });
    }
  }

  test('GPU bake matches the CPU reference within tolerance', async ({ page }) => {
    const bodyId = 'parity-body';
    const climate = derivePlanetClimate(bodyId);
    const pixels = await bakeOnGpu(page, requestFor(bodyId));

    expect(pixels).toHaveLength(WIDTH * HEIGHT * 4);

    let totalError = 0;
    let channels = 0;
    let outliers = 0;

    for (let row = 0; row < HEIGHT; row += 1) {
      for (let column = 0; column < WIDTH; column += 1) {
        // readPixels returns rows bottom-up, so invert to the equirect v axis.
        const u = (column + 0.5) / WIDTH;
        const v = 1 - (row + 0.5) / HEIGHT;
        const expected = sampleAlbedoAt(climate, u, v);
        const offset = (row * WIDTH + column) * 4;

        let worstChannel = 0;
        for (let channel = 0; channel < 3; channel += 1) {
          const delta = Math.abs(pixels[offset + channel] - Math.round(expected[channel] * 255));
          totalError += delta;
          channels += 1;
          worstChannel = Math.max(worstChannel, delta);
        }

        if (worstChannel > OUTLIER_CHANNEL_DELTA) outliers += 1;
      }
    }

    const meanError = totalError / channels;
    const outlierFraction = outliers / (WIDTH * HEIGHT);

    expect(meanError).toBeLessThan(MEAN_ERROR_LIMIT);
    expect(outlierFraction).toBeLessThan(OUTLIER_FRACTION_LIMIT);
  });

  test('GPU material bake matches the CPU reference within tolerance', async ({ page }) => {
    // The material map drives roughness and metalness, so drift here would make
    // water stop looking wet without changing a single albedo pixel.
    const bodyId = 'material-parity-body';
    const climate = derivePlanetClimate(bodyId);
    const pixels = await bakeOnGpu(page, requestFor(bodyId, PLANET_BAKE_MODE_MATERIAL));

    expect(pixels).toHaveLength(WIDTH * HEIGHT * 4);

    let totalError = 0;
    let channels = 0;
    let outliers = 0;

    for (let row = 0; row < HEIGHT; row += 1) {
      for (let column = 0; column < WIDTH; column += 1) {
        const u = (column + 0.5) / WIDTH;
        const v = 1 - (row + 0.5) / HEIGHT;
        const expected = sampleMaterialAt(climate, u, v);
        const offset = (row * WIDTH + column) * 4;

        let worstChannel = 0;
        for (let channel = 0; channel < 3; channel += 1) {
          const delta = Math.abs(pixels[offset + channel] - Math.round(expected[channel] * 255));
          totalError += delta;
          channels += 1;
          worstChannel = Math.max(worstChannel, delta);
        }

        if (worstChannel > OUTLIER_CHANNEL_DELTA) outliers += 1;
      }
    }

    expect(totalError / channels).toBeLessThan(MEAN_ERROR_LIMIT);
    expect(outliers / (WIDTH * HEIGHT)).toBeLessThan(OUTLIER_FRACTION_LIMIT);
  });

  test('GPU material bake separates water from land', async ({ page }) => {
    const bodyId = 'material-parity-body';
    const climate = derivePlanetClimate(bodyId);
    const pixels = await bakeOnGpu(page, requestFor(bodyId, PLANET_BAKE_MODE_MATERIAL));

    let waterRoughness = 0;
    let waterCount = 0;
    let landRoughness = 0;
    let landCount = 0;

    for (let row = 0; row < HEIGHT; row += 1) {
      for (let column = 0; column < WIDTH; column += 1) {
        const roughness = pixels[(row * WIDTH + column) * 4 + 1];
        const [, expectedRoughness] = sampleMaterialAt(climate, (column + 0.5) / WIDTH, 1 - (row + 0.5) / HEIGHT);
        if (expectedRoughness < 0.5) {
          waterRoughness += roughness;
          waterCount += 1;
        } else {
          landRoughness += roughness;
          landCount += 1;
        }
      }
    }

    expect(waterCount).toBeGreaterThan(0);
    expect(landCount).toBeGreaterThan(0);
    expect(waterRoughness / waterCount).toBeLessThan(landRoughness / landCount);
  });

  test('GPU bake is opaque and fully covers the target', async ({ page }) => {
    const pixels = await bakeOnGpu(page, requestFor('coverage-body'));

    for (let index = 3; index < pixels.length; index += 4) {
      expect(pixels[index]).toBe(255);
    }
  });

  test('GPU bake is deterministic for a given body id', async ({ page }) => {
    const first = await bakeOnGpu(page, requestFor('repeat-body'));
    const second = await bakeOnGpu(page, requestFor('repeat-body'));

    expect(second).toEqual(first);
  });

  test('GPU bake differs between body ids', async ({ page }) => {
    const first = await bakeOnGpu(page, requestFor('body-alpha'));
    const second = await bakeOnGpu(page, requestFor('body-beta'));

    expect(second).not.toEqual(first);
  });
});
