# First-Target Asteroid Generation Logic

## Overview

The first-target mission generates a procedurally-determined field of asteroids that the player can scan and target with expendable dart drones. The generation is driven by **seeded determinism** (same inputs always produce the same output) and includes **guaranteed material diversity** via pre-assigned rarities.

## Asteroid Count

Each generated asteroid field contains a **random count between 5 and 20 asteroids** (inclusive):

```
count = floor(random() * 16) + 5
```

- **Minimum**: 5 asteroids
- **Maximum**: 20 asteroids
- **Distribution**: Uniform random

### Generation Context

Asteroids are generated in three scenarios:

1. **Fallback** — When resuming a mission with no prior data (empty server response)
2. **New Launch** — When the player launches from their current ship position with a fresh seed
3. **Resumed** — When the player continues a prior mission session with existing asteroid bodies and sample history

---

## Material Rarity Distribution

Each asteroid is assigned one of **20 materials** across four rarity tiers. The rarity distribution uses **weighted random selection** with the following percentages:

| Rarity     | Weight | Percentage | Material Count |
|------------|--------|------------|-----------------|
| **Common** | 56     | **56%**    | 6 materials     |
| **Uncommon** | 28   | **28%**    | 5 materials     |
| **Rare**   | 12     | **12%**    | 4 materials     |
| **Exotic** | 4      | **4%**     | 5 materials     |

### Material Inventory by Rarity

**Common (56% probability)**
- Carbon (#6f7785)
- Iron (#8f99a7) — **included in iron guarantee below**
- Copper (#b86c45)
- Magnesium (#a2b1be)
- Nickel (#7f98a5)
- Silicon (#9ca8b8)

**Uncommon (28% probability)**
- Lithium (#bba4d6)
- Mercury (#9aaec6)
- Chromium (#8ea5bf)
- Tungsten (#6f7681)
- Titanium (#8ba4b6)

**Rare (12% probability)**
- Silver (#cad5e3)
- Cobalt (#4f6ec7)
- Palladium (#bfc9db)
- Uranium (#80b450)

**Exotic (4% probability)**
- Iridium (#97b6ff)
- Platinum (#d5dce8)
- Gold (#cf9e45)
- Rhodium (#dde7ff)
- Antimony (#a9b9d2)
- Unobtainium (#7deaff)

---

## Iron Guarantee

To ensure gameplay balance and strategic material collection, **every generated asteroid field is guaranteed to contain at least one Iron asteroid**, regardless of random selection:

```typescript
function generateMaterialAssignments(count: number, random: () => number) {
  const materials = Array.from({ length: count }, () => pickWeightedAsteroidMaterial(random));
  
  if (count > 0 && !materials.some((m) => m.material === 'Iron')) {
    const replaceIndex = Math.floor(random() * count);
    materials[replaceIndex] = IRON_MATERIAL;  // Always Common rarity
  }
  
  return materials;
}
```

**Logic:**
1. Generate `count` materials using normal weighted random selection
2. If no Iron is present, replace one random material with Iron
3. Replacement occurs uniformly across all positions in the field

**Impact:**
- Minimum Iron count: 1 per field
- Iron is always Common rarity (the most common variant anyway)
- Probability adjustment: On fields where Iron would naturally be rolled, no replacement occurs

---

## Determinism and Seeding

Asteroid generation is **fully deterministic** when the same parameters are provided. Each scenario uses a computed seed:

### Seed Calculation

```
baseSeed = hash(playerName :: characterId :: centerX : centerY : centerZ)
finalSeed = baseSeed XOR launchSeedHint
```

Where:
- `playerName` and `characterId` identify the player session
- `centerX, centerY, centerZ` specify the galaxy location (in kilometers)
- `launchSeedHint` is optional; if absent or invalid, `baseSeed` is used directly

### Consequences

- **Resuming a mission** at the same location produces identical asteroid fields and velocities
- **Changing location** or **player identity** produces different fields
- **Seeded RNG** uses a Linear Congruential Generator (LCG) for consistent cross-platform results:
  ```
  state = (1664525 * state + 1013904223) & 0xFFFFFFFF
  return state / 0x100000000
  ```

---

## Spatial Distribution

Within a generated field:

- **Cluster Center**: Randomly chosen position in the galaxy (based on seed)
- **Per-Asteroid Positioning**:
  - Arranged in a rough circle around the cluster center
  - **Radial distance**: 6–20 km from center
  - **Vertical spread**: ±4 km above/below the ecliptic plane
  - **Angular jitter**: Applied to avoid perfect grid appearance

- **Kinematics**: Each asteroid has independent randomly-generated velocity and rotation, consistent with deterministic seeding

---

## Material Persistence

Material assignments occur **at generation time** and persist across:

- **Scans**: The player does not discover material until scanning completes
- **Resumed sessions**: Non-destroyed asteroids retain their original server-assigned material
- **Server synchronization**: The server tracks `composition` (material, rarity, textureColor); the client uses this when available

---

## Summary Table

| Aspect | Value |
|--------|-------|
| Asteroid count per field | 5–20 |
| Total materials | 20 |
| Rarity tiers | 4 (Common, Uncommon, Rare, Exotic) |
| Iron guarantee | Always ≥ 1 per field |
| Distribution type | Weighted random (56-28-12-4) |
| Determinism | Full (seeded RNG) |
| Persistence | Per-session (asteroid composition fixed at generation) |

