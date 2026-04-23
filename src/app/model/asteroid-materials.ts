export type AsteroidMaterialRarity = 'Common' | 'Uncommon' | 'Rare' | 'Exotic';

export interface AsteroidMaterialProfile {
	rarity: AsteroidMaterialRarity;
	material: string;
	textureColor: string;
}

const RARITY_WEIGHTS: Record<AsteroidMaterialRarity, number> = {
	Common: 56,
	Uncommon: 28,
	Rare: 12,
	Exotic: 4,
};

// Derived from the shared sheet Material + Rarity rows.
export const ASTEROID_MATERIALS: AsteroidMaterialProfile[] = [
	{ rarity: 'Common', material: 'Carbon', textureColor: '#6f7785' },
	{ rarity: 'Common', material: 'Iron', textureColor: '#8f99a7' },
	{ rarity: 'Common', material: 'Copper', textureColor: '#b86c45' },
	{ rarity: 'Common', material: 'Magnesium', textureColor: '#a2b1be' },
	{ rarity: 'Common', material: 'Nickel', textureColor: '#7f98a5' },
	{ rarity: 'Common', material: 'Silicon', textureColor: '#9ca8b8' },
	{ rarity: 'Uncommon', material: 'Lithium', textureColor: '#bba4d6' },
	{ rarity: 'Uncommon', material: 'Mercury', textureColor: '#9aaec6' },
	{ rarity: 'Uncommon', material: 'Chromium', textureColor: '#8ea5bf' },
	{ rarity: 'Uncommon', material: 'Tungsten', textureColor: '#6f7681' },
	{ rarity: 'Uncommon', material: 'Titanium', textureColor: '#8ba4b6' },
	{ rarity: 'Rare', material: 'Silver', textureColor: '#cad5e3' },
	{ rarity: 'Rare', material: 'Cobalt', textureColor: '#4f6ec7' },
	{ rarity: 'Rare', material: 'Palladium', textureColor: '#bfc9db' },
	{ rarity: 'Rare', material: 'Uranium', textureColor: '#80b450' },
	{ rarity: 'Exotic', material: 'Iridium', textureColor: '#97b6ff' },
	{ rarity: 'Exotic', material: 'Platinum', textureColor: '#d5dce8' },
	{ rarity: 'Exotic', material: 'Gold', textureColor: '#cf9e45' },
	{ rarity: 'Exotic', material: 'Rhodium', textureColor: '#dde7ff' },
	{ rarity: 'Exotic', material: 'Antimony', textureColor: '#a9b9d2' },
	{ rarity: 'Exotic', material: 'Unobtainium', textureColor: '#7deaff' },
];

export function pickWeightedAsteroidMaterial(
	random: () => number = Math.random,
	materials: AsteroidMaterialProfile[] = ASTEROID_MATERIALS,
): AsteroidMaterialProfile {
	if (materials.length === 0) {
		return { rarity: 'Common', material: 'Unknown Composite', textureColor: '#8df7b2' };
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
