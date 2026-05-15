/**
 * Registry that maps normalized ship model keys (slug form) to their GLB asset
 * paths relative to the public/ root.
 *
 * Only models with an entry here are rendered as detailed 3D meshes.
 * Everything else falls back to the generic placeholder.
 *
 * To register a new ship:
 *  1. Add a Node export script under scripts/ (following export-scavenger-pod-glb.mjs)
 *  2. Run it: `npm run export:ships`
 *  3. Add the entry below.
 */

export const SHIP_ASSET_CATALOG = {
  'scavenger-pod': 'models/ships/scavenger-pod.glb',
} as const satisfies Record<string, string>;

export type ShipAssetKey = keyof typeof SHIP_ASSET_CATALOG;

/**
 * Returns the asset path for the given normalized model key (e.g. 'scavenger-pod'),
 * or null if no GLB has been registered for that model.
 */
export function resolveShipAssetPath(modelKey: string): string | null {
  return (SHIP_ASSET_CATALOG as Record<string, string>)[modelKey] ?? null;
}
