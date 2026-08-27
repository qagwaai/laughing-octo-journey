# Architectural Review: `ShipExteriorBareSceneComponent`

**Date:** 2026-08-27  
**File reviewed:** `src/app/scene/ship-exterior/ship-exterior-bare-scene.component.ts`  
**Line count at review time:** 2035  
**Reviewer:** Copilot architectural check-in

---

## Context

This review was triggered by patch-tool failures caused by file size. At 2035 lines, edit anchors frequently collide with other methods in the same file and the tool must match unique strings across a very large context window. Size is a symptom — the root cause is that **four distinct responsibility clusters live directly in the component class** instead of in injectable collaborators.

---

## Status Update (2026-08-27)

The architectural review was useful as a design guide, and the extraction work landed in the codebase with the relevant mission-gate fixes. The current status is:

- `AsteroidPersistenceService` was extracted and wired into the ship-exterior scene flow.
- `InventoryRewardService` was extracted and wired into the reward path.
- `AsteroidScanController` was extracted to isolate hover-scan lifecycle management.
- `MissionGateSimulator` was extracted to isolate mission-gate simulation and state transitions.
- The readonly-vs-mutable array contract was corrected so Angular compilation is clean.
- The first-target / ship-exterior mission-gate regression was isolated and fixed.
- The cold-boot sample-readiness issue was treated correctly as a legitimate zero-sample state rather than forcing fallback asteroid creation at route load.
- Focused Playwright validation for the ship-exterior / mission-gate cluster passed.
- Full Playwright E2E validation passed across the suite.
- Manual validation for the mission flow and scene behavior passed.

Current Step 1 status: complete.
Current Step 2 status: complete.
Current Step 3 status: complete.
Current Step 4 status: complete.
Current Step 5 status: complete.
Current Step 6 status: complete.
Current test coverage status: Step 1, Step 2, Step 3, Step 4, Step 5, and Step 6 dedicated unit tests now exist and cover the extracted behaviors. Step 5 moved the component off the shared singleton runtime revision signal and onto domain-scoped reaction signals. Step 6 moved navigation identity resolution behind an injectable boundary so the scene no longer reads browser history directly.

Validation summary: all unit tests were green, all Playwright E2E tests were green, and all manual validation checks were green. The extraction work is behaving as expected and the user-owned validation gate has been satisfied.

This means the original extraction goal described in this document was achieved: the celestial-body persistence logic has moved out of the bare-scene component and is now covered by dedicated service tests. The inventory-reward logic was extracted into a dedicated service while keeping the component behavior-preserving. The scan orchestration lifecycle was extracted to an isolated `AsteroidScanController`. The mission-gate state transitions are now isolated in `MissionGateSimulator` to keep the scene component focused on orchestration. The runtime reactivity pattern was tightened to domain-scoped revision signals. Navigation identity resolution is now isolated behind an injectable boundary so the scene no longer reads browser history directly.

---

## What the Component Does Well (preserve these)

| Pattern | Where |
|---|---|
| Separate controllers for session, bootstrap, launch, debris | `new ShipExteriorXController()` in field initializers |
| Registry/context pattern | `ShipSceneRegistry`, `ShipSceneContext` |
| Signal/computed for reactive UI state | `activeFlightSnapshot`, `activeAsteroidLine`, etc. |
| Input adapter isolation | `ShipExteriorInputAdapter` |
| `DestroyRef`-based cleanup | `destroyRef.onDestroy(...)` |
| `ChangeDetectionStrategy.OnPush` | component decorator |
| Existing Vitest coverage on extracted pieces | `*.vitest.ts` files in the same folder |

---

## Four Responsibility Clusters Still Living in the Component

### Cluster 1 — Celestial-body persistence (~200 lines)

**Methods:** `persistSeededAsteroidsAsUnscanned`, `persistScanComplete`, `ensureLaunchTargetCelestialBodyId`, `resolveFallbackTargetPositionKm`, `setAsteroidSampleServerCelestialBodyId`

These methods each build a `CelestialBodyUpsertRequest` and call `socketService.upsertCelestialBody(...)`. They share:
- Identity resolution (`sessionKey`, `playerName`, `characterId`)
- Celestial-body ID generation logic (`cb-${characterId}-${missionId}-${sampleId}`)
- Fallback position hashing

**Problem:** This logic cannot be unit-tested without instantiating the full component. The ID formula `cb-${characterId}-${FIRST_TARGET_MISSION_ID}-${sampleId}` appears in at least 3 methods — it is duplicated.

---

### Cluster 2 — Inventory rewards (~120 lines)

**Methods:** `applyMaterialRewards`, `applyYieldedItems`, `persistRewardItemsToBackend`, `consumeLaunchedItem`

These methods build `ShipItem` records and call `sessionService.setActiveShip(...)` and `socketService.upsertItem(...)`. They involve non-trivial mapping logic (quantity expansion, item construction) that should be unit-tested without Angular.

---

### Cluster 3 — Scan orchestration (~120 lines)

**Methods:** `beginAsteroidHoverScan`, `clearHoverScanTimer`, `syncAsteroidHoverScanFromHover`, `forceCompleteIronScan`, `forceCompleteIronScanInContext`, `resolveHoverScanHoldMs`

The hover-scan timer is a separate concern from input handling. It reads and writes component-private signals (`testHoverScanCandidateId`, `testHoverScanContextKey`) and calls `forceCompleteIronScanInContext`. The timer management is duplicated with the target-hold timer (same clear/set pattern, same `window.setTimeout`).

---

### Cluster 4 — Mission gate simulation (~100 lines)

**Methods:** `simulateDebrisCollection`, `simulateManufacture`, `simulateRepair`, `resetMissionGateStateForTest`, `updateMissionGateState`, `setStepStatus`

These encode mission-progression rules (step keys, objective text strings, transition logic). They belong in a mission-domain class, not the view layer. They are partially duplicated with `ShipExteriorLaunchController`'s mission callbacks.

---

## Additional Issues

### `new X()` instead of `inject(X)`

`sessionController`, `bootstrapController`, `floatingDebrisController`, `inputAdapter`, `launchController`, `missionScenePlugin`, and `registry` are all constructed with `new`. Tests cannot replace them without subclassing the component. The existing controllers already accept a plain-object options bag (the right pattern), but the *component* cannot be constructed with mock controllers because they are field-initializer-bound.

### `runtimeRevision` bang

`bumpRuntimeRevision()` is called in ~30 places to force `computed()` to re-evaluate. Each `computed` that reads `runtimeRevision()` must re-run on every frame render because `startAnimationLoop` calls `bumpRuntimeRevision` every `rAF`. This couples UI refresh cadence to game loop cadence.

### Test-API methods live in the component

`forceCompleteIronScan`, `forceTargetAsteroid`, `simulateRepair`, `selectFirstScannedIronTargetForTest`, etc. are called only by `registerTestApi()` and exist solely for E2E testing. They inflate the component and create dead code paths in production.

### Navigation identity resolution

`resolveNavigationIdentity()` reads `window.history.state` directly, making it untestable without a real browser history.

---

## Prioritised Extraction Plan

Each step leaves the component in a passing state and unlocks specific new Vitest tests.

---

### Step 1 — Extract `AsteroidPersistenceService` (highest ROI, ~200 lines removed)

**What moves:** `persistSeededAsteroidsAsUnscanned`, `persistScanComplete`, `ensureLaunchTargetCelestialBodyId`, `resolveFallbackTargetPositionKm`, `setAsteroidSampleServerCelestialBodyId`, and the celestial-body ID formula.

**Interface contract:**
```ts
@Injectable()
export class AsteroidPersistenceService {
  persistSeedBatch(samples: readonly AsteroidScanSample[], intent: ShipExteriorColdBootAsteroidSeedIntent): void
  persistScanComplete(sample: ShipSceneAsteroidSample, actor: SceneActor): void
  ensureServerCelestialBodyId(sample: ShipSceneAsteroidSample, actor: SceneActor): Observable<string>
  buildCelestialBodyId(characterId: string, sampleId: string): string
}
```

It takes `SocketService` and `SessionService` via `inject()`.

**Component change:** Replace inline calls with `inject(AsteroidPersistenceService)`. The component no longer knows how celestial-body IDs are constructed.

**New Vitest tests unlocked:**
- ID generation is deterministic and follows the `cb-{characterId}-{missionId}-{sampleId}` pattern
- `persistScanComplete` skips when identity is missing
- `ensureServerCelestialBodyId` returns existing ID without a socket call
- Fallback position hash is stable for a given sample ID

---

### Step 2 — Extract `InventoryRewardService` (~120 lines removed)

**What moves:** `applyMaterialRewards`, `applyYieldedItems`, `persistRewardItemsToBackend`, `consumeLaunchedItem`, and the `ShipItem` construction helpers.

**Interface contract:**
```ts
@Injectable()
export class InventoryRewardService {
  applyMaterialRewards(materials: readonly LaunchItemYieldedMaterial[], activeShip: ShipSummary): ShipItem[]
  applyYieldedItems(items: readonly LaunchItemYieldedItem[], activeShip: ShipSummary): ShipItem[]
  persistItems(items: readonly ShipItem[], actor: SceneActor): void
  consumeLaunchedItem(response: LaunchItemResponse, activeShip: ShipSummary): ShipSummary
}
```

**New Vitest tests unlocked:**
- Material quantity expansion (3 iron → 3 `ShipItem` records)
- Yielded item deduplication / quantity expansion
- `consumeLaunchedItem` filters the correct item by ID
- `persistRewardItemsToBackend` skips on missing identity

---

### Step 3 — Extract `AsteroidScanController` (~120 lines removed)

**Status:** ready to begin.

**What moves:** hover-scan timer state and lifecycle (`beginAsteroidHoverScan`, `clearHoverScanTimer`, `syncAsteroidHoverScanFromHover`, `resolveHoverScanHoldMs`), and the scan-completion side-effects (`forceCompleteIronScan`, `forceCompleteIronScanInContext`).

Follows the same options-bag pattern used by `ShipExteriorSessionController`. The controller receives `onScanComplete` and `getActiveContext` callbacks.

**Scope guard:** keep this extraction strictly limited to the scan orchestration and timer lifecycle; avoid moving unrelated mission-state or reward behavior into the same class.

**New Vitest tests unlocked:**
- Hover timer fires after configured hold ms (using fake timers)
- Hover timer is cancelled when a different asteroid is hovered
- `forceCompleteIronScan` on an already-scanned sample is a no-op
- `forceCompleteIronScan` on a non-iron asteroid does not advance the mission gate

---

### Step 4 — Move mission-gate simulation into a `MissionGateSimulator` (~100 lines removed)

**What moves:** `simulateDebrisCollection`, `simulateManufacture`, `simulateRepair`, `updateMissionGateState`, `setStepStatus`, `resetMissionGateStateForTest`.

These are already half-duplicated in `ShipExteriorLaunchController`'s callbacks. They should live next to the mission step definitions, not in the view layer.

**New Vitest tests unlocked:**
- `simulateManufacture('hull-patch-kit')` only advances when step is `active`
- `simulateRepair('ship')` produces correct objective text
- `resetMissionGateState` restores all steps to their initial statuses

---

### Step 5 — Address `runtimeRevision` pattern (design improvement, no line removal)

**Status:** ready to begin.

Replace the single bang-revision signal with per-domain signals:

```ts
private readonly asteroidRevision = signal(0);   // bumped only by asteroid state changes
private readonly flightRevision = signal(0);       // bumped only by flight state changes
```

`computed()` chains that currently read `runtimeRevision()` would instead read the narrower, domain-specific signal. This removes the rAF-coupled full-component re-evaluation and reduces unnecessary `computed` invalidations.

---

### Step 6 — Wrap navigation identity behind an injectable (testability improvement)

**Status:** ready to begin.

Replace the `window.history.state` read in `resolveNavigationIdentity()` with an injectable:

```ts
@Injectable()
export class NavigationStateReader {
  resolve(router: Router): { playerName: string; characterId: string }
}
```

---

## Expected Outcome After Steps 1–4

| Metric | Before | After |
|---|---|---|
| Component lines | ~2035 | ~1400–1500 |
| Methods directly in component | ~55 | ~30 |
| Methods testable without Angular TestBed | ~5 (external controllers) | ~30+ |
| Inline socket call-sites | ~8 | 0 (all delegated) |
| Inline `ShipItem` construction | ~40 lines | 0 |

Each step is independently mergeable. **Steps 1 and 2 are the highest value** because they remove the most lines and unlock the most isolated unit tests.

---

## File Size / Patch-Tool Guidance

When the component exceeds ~1500 lines, patch tools fail more frequently because:
1. Edit anchors must be globally unique within the file
2. Long methods reduce the density of unique anchor strings
3. Overlapping concerns mean two unrelated methods often share structural boilerplate

Target: keep the component under **1000 lines** after Step 4. This is achievable without any behaviour change.
