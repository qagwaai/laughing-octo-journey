# Socket Service Pipeline Review Findings

Date: 2026-06-08
Scope: Architectural review of src/app/services/socket.service.ts for clean, maintainable, testable concurrency handling.

## Current Status

- Rollout item 1 (implement FIFO domain pipeline for upsertItem and upsertShip): completed.
- Automated validation: green (focused socket spec and full test suite in latest run).
- Manual validation: completed and passed for item 1 functionality.
- Rollout item 2 (focused queue semantics and teardown tests): completed.
- Decision: proceed to rollout item 3 (extend pipeline to remaining methods).

## Constraints Captured Before Review

- Backend contract changes: client-only first
- Conflict policy: FIFO queue (never drop)
- Domain boundary: by model/request identity type
- Latency budget: 150-300ms acceptable added latency per operation
- Verification preference: focused unit tests

## Findings (Severity Ordered)

### 1) Critical: Pending listener buildup risk on no/late response

Evidence in src/app/services/socket.service.ts:
- Per-request listener registration:
  - `upsertCelestialBody` listener setup
  - `listCelestialBodies` listener setup
  - `upsertShip` listener setup
  - `upsertItem` listener setup
  - `launchItem` listener setup
- Teardown is primarily on successful match paths.
- Only `upsertItem` includes a dedicated no-response timer.

Impact:
- Under concurrency, unmatched or missing responses can leave listeners alive longer than intended, increasing fan-out and race potential.

### 2) Critical: No domain serialization layer before emit

Evidence in src/app/services/socket.service.ts:
- Direct emits in each domain-specific method without a per-domain queue.

Impact:
- Multiple operations touching the same backend model/domain can run concurrently and conflict.

### 3) High: Inconsistent correlation handling across operations

Evidence in src/app/services/socket.service.ts:
- `upsertItem` fast-ignores foreign correlation IDs before mismatch warning.
- Other operations proceed through mismatch warning logic when concurrent responses share channels.

Impact:
- Noisy diagnostics and avoidable callback processing under concurrent traffic.

### 4) High: Disconnect does not clear pending operation state

Evidence in src/app/services/socket.service.ts:
- `disconnect()` closes socket and resets state but does not explicitly fail/cancel pending request bookkeeping.

Impact:
- In-flight operations can outlive expected lifecycle semantics around disconnect/reconnect.

### 5) Medium: Repeated request-response boilerplate increases drift risk

Evidence in src/app/services/socket.service.ts:
- Similar listener/filter/emit logic repeated across methods.

Impact:
- Fixes are harder to apply uniformly and behavior drifts over time.

## Can We Pipeline by Domain to Prevent Conflicts?

Yes. A client-side FIFO domain pipeline is appropriate and aligned with the stated constraints.

Recommended approach:

1. Define a domain key from request identity:
   - operation-group + entityType + containerId (+ characterId where needed)
2. Introduce per-domain FIFO chains:
   - same key serializes, different keys can run in parallel
3. Centralize pending correlation registry:
   - `correlationId -> resolver metadata`
4. Standardize timeout and guaranteed cleanup:
   - always clear listener/timer/pending entry in `finally`
5. Keep socket service responsibilities thin:
   - transport + correlation routing; pipeline orchestration separated for testability

## Existing Precedent in Repo

There is already a useful anti-race pattern in ship-exterior wrapper logic:
- Register pending correlation before emit to avoid ultra-fast response races.

This pattern can be generalized into the shared socket pipeline architecture.

## Proposed Implementation Shape

- Add a reusable pipeline utility/service:
  - `enqueue(domainKey, operationFn): Promise<T>`
  - internal `Map<domainKey, Promise<void>>` for FIFO chaining
- Add a shared pending map:
  - `Map<correlationId, PendingOperation>`
- Move to one canonical listener per response event channel:
  - dispatch by `correlationId`, ignore unknown/foreign IDs quickly
- Refactor operation methods (`upsert*`, `launch*`, list methods):
  - build correlation + identity
  - compute domain key
  - enqueue send/await path

## Focused Unit Tests Recommended

1. Same domain key serializes operations (op2 emit waits for op1 resolve).
2. Different domain keys run in parallel.
3. Timeout unblocks next queued operation for same key.
4. Disconnect clears/fails pending operations deterministically.
5. Foreign correlation responses are ignored without listener leak.
6. Late response after timeout does not re-complete a closed operation.

## Risks / Open Questions

- Should `characterId` always be part of domain key, or only for shared containers?
- Should read/list operations be serialized with writes for same key, or allowed parallelism?
- Do we want queue depth and per-domain in-flight metrics for debugging?

## Suggested Rollout (Client-Only First)

1. Implement pipeline for upsertItem and upsertShip first.
  - Status: complete.
  - Validation: unit tests green and manual test complete.
2. Add focused specs for queue semantics and teardown behavior.
  - Status: complete.
3. Extend to remaining methods after proving stability.
4. Add lightweight metrics/logging for queue depth and wait time.

## Item 1 Completion Record

Implementation outcome:
- Per-domain FIFO queueing is now applied for upsertItem and upsertShip.
- Same-domain operations serialize; different-domain operations can still execute without global blocking.
- Queue no-response paths are bounded by timeout so same-domain queues do not deadlock.

Validation outcome:
- Focused socket tests passed after queue and spec timing adjustments.
- Full npm test run passed.
- Manual test pass confirmed by operator.

## Item 2 Preparation Plan (Focused Specs Expansion)

Objective:
- Strengthen regression safety for queue semantics and teardown guarantees around the new pipeline behavior.

Ready-to-implement checklist:
1. Add/confirm a same-domain timeout-unblocks-next test for item-upsert queue progression.
2. Add/confirm a same-domain timeout-unblocks-next test for ship-upsert queue progression.
3. Add a different-domain parallelism test proving no unnecessary serialization across distinct domain keys.
4. Add disconnect lifecycle test proving queued/pending operations do not leak or leave stale queue state.
5. Add late-response-after-timeout test proving timed-out operations do not re-complete or mutate settled queue state.

Acceptance criteria for item 2:
- New/updated focused tests are deterministic and green.
- No behavior regression in existing socket correlation tests.
- No new TypeScript or Angular diagnostics in touched files.

## Item 2 Completion Record

Implementation outcome:
- Added focused queue and teardown coverage in socket service specs for:
  - same-domain timeout unblocks next queued operation (item and ship)
  - different-domain item upserts are not unnecessarily serialized
  - disconnect clears domain queue state for follow-on same-domain work
  - late response after timeout does not corrupt settled queue progression

Validation outcome:
- Focused socket suite passed with all tests green.
- Existing socket correlation scenarios remained green.

## Item 3 Completion Record

Implementation outcome:
- Extended domain FIFO queue usage to remaining socket operations in scope, including celestial-body upsert/list and launch flows.
- Preserved existing correlation filtering behavior while aligning queue entry points across methods.
- Stabilized deterministic ship-exterior mission-flow behavior by ensuring simulated manufacture/repair progression participates in mission progress upsert sequencing used by the runtime path.

Validation outcome:
- Full unit test run green.
- Targeted Playwright regression case green:
  - `e2e/tests/ship-exterior-test-utils.spec.ts` (`completes deterministic mission flow and emits completed mission status`)
- Full Playwright e2e run green.
- Manual validation completed and passed.

Current gate:
- Item 3 complete.

## Item 4 Progress Record (Disconnect Pending State Cleanup)

Implementation outcome:
- Added explicit pending-operation bookkeeping in `src/app/services/socket.service.ts` via correlation-id keyed cancel callbacks.
- `disconnect()` now cancels and clears pending operations before socket teardown, so listener/timer cleanup is deterministic instead of waiting for no-response timers.
- Each queued request path now registers pending cleanup and clears that pending state on normal completion.

Validation status:
- Added focused unit coverage in `src/app/services/socket.service.spec.ts` to verify pending response listeners are canceled immediately on disconnect.
- TypeScript diagnostics on touched files are clean.
- Full unit test execution is green.
- Full e2e execution is green.
- Manual testing completed and passed.

Current gate:
- Item 4 complete.
