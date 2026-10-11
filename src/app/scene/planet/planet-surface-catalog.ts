import type { CatalogIdentity } from '../../model/catalog-identity';

export interface PlanetSurfaceTextureFiles {
  preview: {
    albedo: string;
  };
  low: {
    albedo: string;
    normal: string;
  };
  standard: {
    albedo: string;
    normal: string;
  };
}

export interface CatalogPlanetSurfaceAsset {
  identity: CatalogIdentity;
  assetVersion: string;
  assetDirectory: string;
  files: PlanetSurfaceTextureFiles;
  clouds: boolean;
  credit: string;
  citations: readonly string[];
  sourceLinks: readonly { href: string; text: string }[];
  normalDimensions: Readonly<Record<'low' | 'standard', readonly [number, number]>>;
}

export const SOL_PLANET_SURFACE_CATALOG = [
  {
    identity: { namespace: 'sol', key: 'earth' },
    assetVersion: 'earth-july-v2',
    assetDirectory: 'assets/sol-textures/earth-july-v2',
    clouds: true,
    credit: 'Reto St\u00f6ckli, NASA Earth Observatory (NASA/GSFC); NOAA GLOBE v1.0, DTED Level 0/NIMA',
    citations: [
      'R. Stockli, E. Vermote, N. Saleous, R. Simmon and D. Herring (2005), Blue Marble Next Generation; NOAA GLOBE v1.0',
    ],
    sourceLinks: [
      { href: 'https://science.nasa.gov/earth/earth-observatory/blue-marble-next-generation/', text: 'NASA BMNG' },
      { href: 'https://www.ngdc.noaa.gov/mgg/topo/globe.html', text: 'NOAA GLOBE' },
      { href: 'https://www.nasa.gov/nasa-brand-center/images-and-media/', text: 'NASA media guidelines' },
    ],
    normalDimensions: { low: [1024, 512], standard: [2048, 1024] },
    files: {
      preview: { albedo: 'earth-july-preview-albedo.jpg' },
      low: { albedo: 'earth-july-low-albedo.jpg', normal: 'earth-july-low-normal.png' },
      standard: { albedo: 'earth-july-standard-albedo.jpg', normal: 'earth-july-standard-normal.png' },
    },
  },
  {
    identity: { namespace: 'sol', key: 'luna' },
    assetVersion: 'luna-v3',
    assetDirectory: 'assets/sol-textures/luna-v3',
    clouds: false,
    credit: "NASA's Scientific Visualization Studio; Ernie Wright (USRA), Noah Petro (NASA/GSFC), LROC and LOLA teams",
    citations: [
      'Sato et al. (2017), Lunar Mare TiO2 Abundances Estimated from UV/Vis Reflectance, Icarus 296, 216-238; doi:10.1016/j.icarus.2017.06.013',
    ],
    sourceLinks: [
      { href: 'https://svs.gsfc.nasa.gov/4720/', text: 'NASA CGI Moon Kit' },
      { href: 'https://www.nasa.gov/nasa-brand-center/images-and-media/', text: 'NASA media guidelines' },
    ],
    normalDimensions: { low: [1024, 512], standard: [1024, 512] },
    files: {
      preview: { albedo: 'luna-preview-albedo.jpg' },
      low: { albedo: 'luna-low-albedo.jpg', normal: 'luna-low-normal.png' },
      standard: { albedo: 'luna-standard-albedo.jpg', normal: 'luna-standard-normal.png' },
    },
  },
  {
    identity: { namespace: 'sol', key: 'mars' },
    assetVersion: 'mars-v2',
    assetDirectory: 'assets/sol-textures/mars-v2',
    clouds: false,
    credit: 'NASA/Viking/PDS, USGS Astrogeology; NASA/MGS/MOLA team',
    citations: [
      'Eliason, Batson and Manley (2001), Mars Mosaicked Digital Image Model and Digital Terrain Model, NASA PDS',
      'Smith, Zuber, Neumann, Guinness and Slavney (2003), Mars Global Surveyor Laser Altimeter Mission Experiment Gridded Data Record, MGS-M-MOLA-5-MEGDR-L3-V1.0, NASA PDS',
    ],
    sourceLinks: [
      {
        href: 'https://astrogeology.usgs.gov/search/map/mars_viking_global_color_mosaic_925m',
        text: 'USGS Viking mosaic',
      },
      { href: 'https://pds-geosciences.wustl.edu/missions/mgs/megdr.html', text: 'NASA MOLA' },
      {
        href: 'https://www.usgs.gov/information-policies-and-instructions/copyrights-and-credits',
        text: 'USGS reuse policy',
      },
    ],
    normalDimensions: { low: [1024, 512], standard: [2048, 1024] },
    files: {
      preview: { albedo: 'mars-preview-albedo.jpg' },
      low: { albedo: 'mars-low-albedo.jpg', normal: 'mars-low-normal.png' },
      standard: { albedo: 'mars-standard-albedo.jpg', normal: 'mars-standard-normal.png' },
    },
  },
] as const satisfies readonly CatalogPlanetSurfaceAsset[];

export function resolveCatalogPlanetSurfaceAsset(
  identity: CatalogIdentity | null | undefined,
): CatalogPlanetSurfaceAsset | null {
  if (!identity) return null;
  return (
    SOL_PLANET_SURFACE_CATALOG.find(
      (asset) => asset.identity.namespace === identity.namespace && asset.identity.key === identity.key,
    ) ?? null
  );
}
