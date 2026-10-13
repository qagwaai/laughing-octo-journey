import { ClampToEdgeWrapping, NoColorSpace, RepeatWrapping, SRGBColorSpace, TextureLoader, type Texture } from 'three';
import type { PlanetBakeResult } from './planet-bake';
import type { CatalogPlanetSurfaceRequest } from './planet-surface-resolver';

export type CatalogTextureVariant = 'preview' | 'low' | 'standard';

export interface CatalogSurfaceLoadRequest extends CatalogPlanetSurfaceRequest {
  variant: CatalogTextureVariant;
  estimatedBytes: number;
}

export interface CatalogPlanetSurfaceResult {
  source: 'catalog';
  albedo: Texture<HTMLImageElement>;
  normal?: Texture<HTMLImageElement>;
  material?: Texture;
  request: CatalogSurfaceLoadRequest;
  dispose(): void;
}

export type PlanetSurfaceResult = PlanetBakeResult | CatalogPlanetSurfaceResult;

export function catalogTextureDimensions(request: CatalogSurfaceLoadRequest): {
  albedo: readonly [number, number];
  normal?: readonly [number, number];
} {
  const files = request.asset.files[request.variant];
  const normalFile = 'normal' in files ? files.normal : undefined;
  const normalDimensions =
    normalFile && request.variant !== 'preview' ? request.asset.normalDimensions?.[request.variant] : undefined;
  if (normalFile && !normalDimensions) {
    throw new Error(`Missing normal-map dimensions for ${request.asset.identity.key} ${request.variant} tier`);
  }
  return {
    albedo: request.variant === 'preview' ? [512, 256] : request.variant === 'low' ? [2048, 1024] : [4096, 2048],
    normal: normalDimensions,
  };
}

export function estimateCatalogSurfaceBytes(
  request: CatalogPlanetSurfaceRequest,
  variant: CatalogTextureVariant,
): number {
  const dimensions = catalogTextureDimensions({ ...request, variant, estimatedBytes: 0 });
  return [dimensions.albedo, dimensions.normal].reduce<number>(
    (bytes, size) => bytes + (size ? Math.ceil(size[0] * size[1] * 4 * (4 / 3)) : 0),
    0,
  );
}

export async function loadCatalogSurface(request: CatalogSurfaceLoadRequest): Promise<CatalogPlanetSurfaceResult> {
  const loader = new TextureLoader();
  const files = request.asset.files[request.variant];
  const dimensions = catalogTextureDimensions(request);
  const owned: Texture[] = [];
  const load = async (
    filename: string,
    size: readonly [number, number],
    albedo: boolean,
  ): Promise<Texture<HTMLImageElement>> => {
    const texture = await loader.loadAsync(`textures/sol/${request.asset.assetVersion}/${filename}`);
    owned.push(texture);
    if (texture.image.width !== size[0] || texture.image.height !== size[1]) {
      throw new Error(`Unexpected dimensions for ${filename}: ${texture.image.width}x${texture.image.height}`);
    }
    texture.colorSpace = albedo ? SRGBColorSpace : NoColorSpace;
    texture.flipY = true;
    texture.wrapS = RepeatWrapping;
    texture.wrapT = ClampToEdgeWrapping;
    texture.needsUpdate = true;
    return texture;
  };
  try {
    const albedo = await load(files.albedo, dimensions.albedo, true);
    const normalFile = 'normal' in files ? files.normal : undefined;
    const normal = normalFile && dimensions.normal ? await load(normalFile, dimensions.normal, false) : undefined;
    return {
      source: 'catalog',
      albedo,
      normal,
      request,
      dispose: () => owned.forEach((texture) => texture.dispose()),
    };
  } catch (error) {
    owned.forEach((texture) => texture.dispose());
    throw error;
  }
}
