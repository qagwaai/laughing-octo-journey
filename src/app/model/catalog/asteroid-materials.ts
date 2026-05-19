/**
 * Asteroid material catalog definitions and weighted-selection helpers.
 */
export type AsteroidMaterialRarity = 'Common' | 'Uncommon' | 'Rare' | 'Exotic';

export interface AsteroidMaterialProfile {
  rarity: AsteroidMaterialRarity;
  material: string;
  textureColor: string;
  roughness?: number;
  metalness?: number;
  emissiveBoost?: number;
}

const RARITY_WEIGHTS: Record<AsteroidMaterialRarity, number> = {
  Common: 56,
  Uncommon: 28,
  Rare: 12,
  Exotic: 4,
};

// Derived from the shared sheet Material + Rarity rows.
export const ASTEROID_MATERIALS: AsteroidMaterialProfile[] = [
  { rarity: 'Common', material: 'Carbon', textureColor: '#6f7785', roughness: 0.9, metalness: 0.05 },
  { rarity: 'Common', material: 'Iron', textureColor: '#8f99a7', roughness: 0.62, metalness: 0.74 },
  { rarity: 'Common', material: 'Copper', textureColor: '#b86c45', roughness: 0.6, metalness: 0.7 },
  { rarity: 'Common', material: 'Magnesium', textureColor: '#a2b1be', roughness: 0.86, metalness: 0.08 },
  { rarity: 'Common', material: 'Nickel', textureColor: '#7f98a5', roughness: 0.58, metalness: 0.78 },
  { rarity: 'Common', material: 'Silicon', textureColor: '#9ca8b8', roughness: 0.84, metalness: 0.04 },
  { rarity: 'Uncommon', material: 'Lithium', textureColor: '#bba4d6', roughness: 0.58, metalness: 0.62 },
  { rarity: 'Uncommon', material: 'Mercury', textureColor: '#9aaec6', roughness: 0.55, metalness: 0.75 },
  { rarity: 'Uncommon', material: 'Chromium', textureColor: '#8ea5bf', roughness: 0.58, metalness: 0.8 },
  { rarity: 'Uncommon', material: 'Tungsten', textureColor: '#6f7681', roughness: 0.64, metalness: 0.7 },
  { rarity: 'Uncommon', material: 'Titanium', textureColor: '#8ba4b6', roughness: 0.6, metalness: 0.7 },
  { rarity: 'Rare', material: 'Silver', textureColor: '#cad5e3', roughness: 0.28, metalness: 0.92 },
  { rarity: 'Rare', material: 'Cobalt', textureColor: '#4f6ec7', roughness: 0.6, metalness: 0.75 },
  { rarity: 'Rare', material: 'Palladium', textureColor: '#bfc9db', roughness: 0.32, metalness: 0.9 },
  { rarity: 'Rare', material: 'Uranium', textureColor: '#80b450', roughness: 0.7, metalness: 0.3, emissiveBoost: 0.35 },
  { rarity: 'Exotic', material: 'Iridium', textureColor: '#97b6ff', roughness: 0.24, metalness: 0.94 },
  { rarity: 'Exotic', material: 'Platinum', textureColor: '#d5dce8', roughness: 0.24, metalness: 0.92 },
  { rarity: 'Exotic', material: 'Gold', textureColor: '#cf9e45', roughness: 0.3, metalness: 0.9 },
  { rarity: 'Exotic', material: 'Rhodium', textureColor: '#dde7ff', roughness: 0.26, metalness: 0.92 },
  { rarity: 'Exotic', material: 'Antimony', textureColor: '#a9b9d2', roughness: 0.4, metalness: 0.6 },
  { rarity: 'Exotic', material: 'Unobtainium', textureColor: '#7deaff', roughness: 0.28, metalness: 0.64, emissiveBoost: 0.45 },
];

export function pickWeightedAsteroidMaterial(
  random: () => number = Math.random,
  materials: AsteroidMaterialProfile[] = ASTEROID_MATERIALS,
): AsteroidMaterialProfile {
  if (materials.length === 0) {
    return {
      rarity: 'Common',
      material: 'Unknown Composite',
      textureColor: '#8df7b2',
      roughness: 0.7,
      metalness: 0.25,
    };
  }

  const totalWeight = materials.reduce((sum, item) => sum + RARITY_WEIGHTS[item.rarity], 0);
  let roll = random() * totalWeight;

  for (const material of materials) {
    roll -= RARITY_WEIGHTS[material.rarity];
    if (roll <= 0) {
      return material;
    }
  }

  return materials[materials.length - 1] ?? materials[0];
}
