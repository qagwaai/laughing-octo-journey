# SW-13 Phase-1 Readiness Contract + Hangar State Machine Spec (2026-07-11)

Status owner: Nova (frontend)
Scope: Test-foundation stabilization track only
Related plan: sw-13-test-foundation-investment-plan-2026-07-11.md

## 1. Goal

Provide a deterministic, read-only contract for Ship Hangar readiness and formalize hangar load states so tests can assert lifecycle transitions without implicit timing loops.

## 2. Contract Surface (v1)

Window surface (non-production only):
1. window.__sw13AppTestReadiness
2. version: sw13.v1
3. getSnapshot(): Sw13AppTestReadinessSnapshot

Contract rules:
1. Read-only API. No mutation functions are exposed.
2. Contract is versioned and can evolve with additive fields.
3. Contract data is safe for polling from Playwright/e2e page objects.

## 3. Snapshot Schema (v1)

Top-level:
1. version: sw13.v1
2. hangar: ShipHangarReadinessSnapshot

Hangar snapshot fields:
1. state: idle | loading | loaded | empty | error
2. requestGeneration: monotonically increasing request token
3. shipCount: normalized ship count for latest accepted response
4. error: null or user-facing error string
5. routeContext: playerName, characterId, shipId
6. lastSuccessfulLoad: requestGeneration + shipCount + loadedAtEpochMs
7. updatedAtEpochMs: timestamp of latest snapshot write

## 4. Hangar State Machine (Phase-1)

States:
1. idle
2. loading
3. loaded
4. empty
5. error

Transitions:
1. idle -> loading when loadShipsForCharacter starts a valid request.
2. loading -> loaded when success response contains >= 1 normalized ships.
3. loading -> empty when success response contains 0 ships.
4. loading -> error when response is unsuccessful.
5. any -> error when required identity/session preconditions are missing.
6. any -> loading when a newer requestGeneration starts.

Out-of-order response policy:
1. Each load request captures requestGeneration.
2. Response handlers ignore stale generations that are not the latest active generation.

## 5. Milestone-3C Consumption Preparation

Preparation contract for Milestone-3C follow-up:
1. Consumers read readiness snapshot only through getSnapshot().
2. Milestone-3C production features must not write or mutate readiness state directly.
3. Any Milestone-3C diagnostics should consume v1 fields and remain no-op in production mode.

## 6. Non-Goals in This Phase

1. No e2e spec rewrites yet.
2. No transport/socket contract changes in this phase.
3. No test-only production hacks or mutable debug backdoors.
