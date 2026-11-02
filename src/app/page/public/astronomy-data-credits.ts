export interface AstronomyDataCredit {
  id: string;
  source: string;
  text: string;
  links: readonly { label: string; url: string }[];
  citation?: string;
  citationLink?: { label: string; url: string };
  license?: { name: string; url: string };
}

export const SOLAR_SYSTEM_DATA_CREDITS: readonly AstronomyDataCredit[] = [
  {
    id: 'S1',
    source: 'International Astronomical Union’s Minor Planet Center',
    text: "This research has made use of data and/or services provided by the International Astronomical Union's Minor Planet Center.",
    links: [
      { label: 'Minor Planet Center', url: 'https://www.minorplanetcenter.net/' },
      { label: 'Comet elements', url: 'https://www.minorplanetcenter.net/iau/MPCORB/AllCometEls.txt' },
      {
        label: 'Comet orbit format',
        url: 'https://docs.minorplanetcenter.net/mpc-ops-docs/orbits/comet-orbit-format/',
      },
    ],
  },
  {
    id: 'S2',
    source: 'NASA/JPL Solar System Dynamics',
    text: 'Planetary satellite mean orbital elements courtesy of NASA/JPL Solar System Dynamics.',
    links: [
      { label: 'Satellite mean elements', url: 'https://ssd.jpl.nasa.gov/sats/elem/' },
      { label: 'Satellite discoveries', url: 'https://ssd.jpl.nasa.gov/sats/discovery.html' },
    ],
  },
  {
    id: 'S3',
    source: 'NASA/JPL Small-Body Database',
    text: 'Orbit of 2026 ED138 from the NASA/JPL Small-Body Database.',
    links: [
      {
        label: '2026 ED138 database record',
        url: 'https://ssd.jpl.nasa.gov/tools/sbdb_lookup.html#/?sstr=2026%20ED138',
      },
    ],
  },
  {
    id: 'S4',
    source: 'NSF–DOE Vera C. Rubin Observatory',
    text: 'Dwarf-planet candidate status for 2026 ED138 as announced by the NSF–DOE Vera C. Rubin Observatory.',
    links: [],
  },
  {
    id: 'S5',
    source: 'Cassini Imaging Team (CICLOPS)',
    text: 'S/2009 S 1 orbit based on the Cassini Imaging Team report.',
    links: [{ label: 'Cassini Imaging Team report', url: 'https://ciclops.org/view_popup.php?id=5926.html' }],
  },
  {
    id: 'S6',
    source: 'NASA planetary fact sheets, JPL Horizons, and IAU minor-body data',
    text: 'Planet and major-moon values adapted from NASA planetary fact sheets and JPL Horizons; dwarf-planet data from IAU minor-body sources.',
    links: [{ label: 'NASA planetary fact sheets', url: 'https://nssdc.gsfc.nasa.gov/planetary/factsheet/' }],
  },
  {
    id: 'S7',
    source: 'HYG Database (astronexus)',
    text: 'Star data from the HYG Database (codeberg.org/astronexus/hyg).',
    links: [{ label: 'Astronexus HYG Database', url: 'https://codeberg.org/astronexus/hyg' }],
    license: { name: 'CC BY-SA 4.0', url: 'https://creativecommons.org/licenses/by-sa/4.0/' },
  },
];

export const EXOPLANET_DATA_CREDITS: readonly AstronomyDataCredit[] = [
  {
    id: 'A1',
    source: 'NASA Exoplanet Archive',
    text: 'This research has made use of the NASA Exoplanet Archive, which is operated by the California Institute of Technology, under contract with the National Aeronautics and Space Administration under the Exoplanet Exploration Program.',
    links: [{ label: 'NASA Exoplanet Archive', url: 'https://exoplanetarchive.ipac.caltech.edu/' }],
    citation: 'Christiansen et al. (2025), PSJ.',
    citationLink: { label: 'DOI: 10.3847/PSJ/ade3c2', url: 'https://doi.org/10.3847/PSJ/ade3c2' },
  },
  {
    id: 'A3',
    source: 'HYG Database v4.4 (astronexus)',
    text: 'HYG Database v4.4, astronexus (codeberg.org/astronexus/hyg). Cross-matched with the NASA Exoplanet Archive and subset by Stellar.',
    links: [{ label: 'Astronexus HYG Database', url: 'https://codeberg.org/astronexus/hyg' }],
    license: { name: 'CC BY-SA 4.0', url: 'https://creativecommons.org/licenses/by-sa/4.0/' },
  },
  {
    id: 'A4',
    source: 'AT-HYG v4.0 (astronexus)',
    text: 'AT-HYG v4.0, astronexus (codeberg.org/astronexus/athyg). Cross-matched with the NASA Exoplanet Archive and subset by Stellar.',
    links: [{ label: 'AT-HYG Database', url: 'https://codeberg.org/astronexus/athyg' }],
    license: { name: 'CC BY-SA 4.0', url: 'https://creativecommons.org/licenses/by-sa/4.0/' },
  },
  {
    id: 'A5',
    source: 'ESA Gaia DR3',
    text: 'This work has made use of data from the European Space Agency (ESA) mission Gaia (https://www.cosmos.esa.int/gaia), processed by the Gaia Data Processing and Analysis Consortium (DPAC, https://www.cosmos.esa.int/web/gaia/dpac/consortium). Funding for the DPAC has been provided by national institutions, in particular the institutions participating in the Gaia Multilateral Agreement.',
    links: [
      { label: 'ESA Gaia mission', url: 'https://www.cosmos.esa.int/gaia' },
      {
        label: 'Gaia Data Processing and Analysis Consortium',
        url: 'https://www.cosmos.esa.int/web/gaia/dpac/consortium',
      },
    ],
  },
  {
    id: 'A6',
    source: 'ESA Hipparcos and Tycho-2',
    text: 'ESA, 1997, The Hipparcos and Tycho Catalogues, ESA SP-1200.',
    links: [],
  },
];

export const SECONDARY_EXOPLANET_DATA_CREDITS: readonly AstronomyDataCredit[] = [
  {
    id: 'A7',
    source: 'Yale Bright Star and Gliese–Jahreiß catalogs',
    text: 'Hoffleit, Catalogue of Bright Stars, 5th ed. (1991); Gliese & Jahreiß (1991), Preliminary Version of the Third Catalogue of Nearby Stars.',
    links: [],
  },
  {
    id: 'A8',
    source: 'IAU Working Group on Star Names',
    text: 'Star names from the IAU Working Group on Star Names.',
    links: [],
  },
];

/** A10 stays behind `environment.nameExoWorldsCreditEnabled` until the IAU reuse terms are confirmed. */
export const NAME_EXOWORLDS_DATA_CREDIT: AstronomyDataCredit = {
  id: 'A10',
  source: 'IAU NameExoWorlds 2015',
  text: 'Exoplanet names approved by the IAU through the NameExoWorlds contest (2015), nameexoworlds.iau.org.',
  links: [],
};

export function secondaryExoplanetDataCredits(includeNameExoWorlds: boolean): readonly AstronomyDataCredit[] {
  return includeNameExoWorlds
    ? [...SECONDARY_EXOPLANET_DATA_CREDITS, NAME_EXOWORLDS_DATA_CREDIT]
    : SECONDARY_EXOPLANET_DATA_CREDITS;
}
