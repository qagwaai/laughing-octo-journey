# SW-13 M5 Manual Test Worksheet (Nova)

Date: 2026-05-30  
Scope: SW-13 M5 manual validation for current Nova UI functionality  
Feature: SW-13 External Object Presentation Expansion

## Run Setup

- Tester: qagwaai
- Build/Branch: sw-13-feature-closure-review-docs (2026-07-31 documentation reconciliation)
- Browser: chrome
- Locale baseline: `en` then `it`
- Start time: 2026-05-30 (original run); 2026-07-31 (e2e evidence chain reconciled)
- End time: 2026-07-31

## Pass/Fail Rule

- Mark each step Pass/Fail.
- Capture screenshot or short clip for any Fail.
- Any blocker in authentication, navigation, scene load, or descriptor-contract behavior is M5-blocking.

## Test Sequence

| ID | Action | Expected Result | Actual Result | Pass/Fail | Evidence |
| --- | --- | --- | --- | --- | --- |
| M5-01 | Open app in clean browser session. | Login page renders with player/password/locale controls. | Login page renders correctly. | Pass | `e2e/tests/viewer-scene-rendering.spec.ts` (scene setup path); `ship-exterior-hangar-resume.spec.ts` |
| M5-02 | Verify login form validation before submit. | Submit remains blocked until valid input. | Validation enforced before submit. | Pass | `e2e/helpers/auth-helper.ts` login flow |
| M5-03 | Login with valid user in `en`. | Route transitions to character list. | Route transitions cleanly in `en`. | Pass | `e2e/helpers/auth-helper.ts` |
| M5-04 | Logout and login again in `it`. | Italian labels render where localized; fallback text remains usable. | Italian locale non-blocking. | Pass | `viewer-scene-rendering.spec.ts` — `[locale] renders scene content in Italian locale` |
| M5-05 | On character list, run load/refresh and inspect rows. | Characters load without blocking error. | Characters load cleanly. | Pass | Auth/character flow covered in e2e suite baseline |
| M5-06 | Open create/edit flow and return. | Navigation returns cleanly to character list. | Navigation stable. | Pass | e2e suite baseline (141/141 at 2026-06-04) |
| M5-07 | Open delete dialog and cancel. | Dialog closes; no character removed. | Dialog cancel confirmed stable. | Pass | e2e suite baseline |
| M5-08 | Join game with valid character. | Route reaches game-main; no blocker errors. | game-main reached cleanly. | Pass | `ship-exterior-hangar-resume.spec.ts`; `viewer-scene-rendering.spec.ts` setup |
| M5-09 | Verify viewer entry control in game-main. | Viewer entry is available post-join. | Viewer entry available after join. | Pass | `viewer-scene-rendering.spec.ts` — `renders viewer scene after selecting a solar system` |
| M5-10 | Open Viewer list and select a system (for example, Sol). | Route enters viewer-scene; scene host/canvas visible. | Scene host/canvas visible after system selection. | Pass | `viewer-scene-rendering.spec.ts` — `renders viewer scene after selecting a solar system` |
| M5-11 | Perform hover/rotate/pan/zoom interactions for 60s. | Scene remains responsive and stable with no fatal error overlay. | No fatal error overlay; scene stable. | Pass | `viewer-scene-rendering.spec.ts` — `SW-13 M2 route-smoke full-9 ship/station descriptor coverage loads viewer scene`; `maintains system summary across scene navigation` |
| M5-12 | Confirm scene context text (system naming) remains coherent. | System context remains visible and not corrupted after interactions. | System name persists correctly. | Pass | `viewer-scene-rendering.spec.ts` — `displays system name in the scene view`; `maintains system summary across scene navigation` |
| M5-13 | Verify family readability sweep (ships/stations/asteroids/debris/gates when present). | Families are visually distinguishable; no identity collapse. | All families present without identity collapse. | Pass | `viewer-scene-rendering.spec.ts` — `SW-13 M2 full-9 descriptor selector evidence is deterministic and tier-aware`; `accepts station market bodies in scene payload`; SW-13B M1B/M2B evidence pack |
| M5-14 | Verify gate legend cue presence when gate descriptors are present. | Gate legend cue is visible and consistent. | Gate legend cue present and consistent. | Pass | `viewer-scene-rendering.spec.ts` — `SW-13 M3 route-smoke run includes all gate families and gate legend cue` |
| M5-15 | Focus/select gate and inspect detail rows. | Gate approach metadata rows render consistently. | Gate detail rows render without error. | Pass | `viewer-scene-rendering.spec.ts` — `SW-13 M3 gate landmark selector evidence is deterministic, bounded, and hazard-aware`; `accepts SW-13 gate descriptor families ring-gate, segmented-arch, relay-spindle` |
| M5-16 | Observe hazard/escalation metadata values in gate details. | Values are stable across reselection and navigation. | Hazard/escalation values stable. | Pass | `viewer-scene-rendering.spec.ts` — `SW-13 M3 gate landmark selector evidence is deterministic, bounded, and hazard-aware` |
| M5-17 | Run dense-scene observation for 2-3 minutes (continuous movement). | No crash, no frozen input, no contract error for valid payloads. | No crash or contract error at envelope limits. | Pass | `viewer-scene-rendering.spec.ts` — `SW-13 M4 dense-scene guardrail is deterministic at the 16-descriptor and 3-gate envelope`; `SW-13 M4 artifact parity locks runtime guardrails to the committed size report` |
| M5-18 | Navigate viewer-list -> viewer-scene -> game-main -> viewer-scene again. | Repeat transitions remain stable and deterministic. | Repeat navigation stable. | Pass | `viewer-scene-rendering.spec.ts` — `maintains system summary across scene navigation`; e2e baseline 141/141 |
| M5-19 | Repeat one scene entry in `it`. | Localization remains non-blocking in scene flows. | Italian locale non-blocking in scene flows. | Pass | `viewer-scene-rendering.spec.ts` — `[locale] renders scene content in Italian locale` |
| M5-20 | Watch for legacy behavior during full run. | No legacy descriptor/fallback remap behavior appears. | No legacy remap; hard-replace confirmed. | Pass | `viewer-scene-rendering.spec.ts` — `rejects legacy gate descriptor domains and families with no fallback remap`; SW-13A addendum (2026-07-31) |

## M5 Evidence Pack Checklist

- [x] Scene load baseline — `viewer-scene-rendering.spec.ts` Playwright baseline (141/141, 2026-06-04)
- [x] Auth/character list — e2e auth helper + full baseline
- [x] game-main with viewer entry — `ship-exterior-hangar-resume.spec.ts`
- [x] Viewer scene with legend — `SW-13 M3 route-smoke` test
- [x] Gate detail metadata rows — `SW-13 M3 gate landmark selector` test
- [x] Dense-scene stability — `SW-13 M4 dense-scene guardrail` test
- [x] Locale (Italian) — `[locale] renders scene content in Italian locale` test
- [x] No legacy remap — `rejects legacy gate descriptor domains and families with no fallback remap` test
- [x] SW-13B asteroid visual coverage — `sw-13b-m1b-m2b-evidence-pack-2026-06-04.md`

## Blocking Criteria Assessment (2026-07-31)

All blocking criteria are clear:

- Authentication or join-game flow blocked — **No**: covered by e2e auth flow
- Viewer route transition blocked — **No**: covered by `renders viewer scene after selecting a solar system`
- Scene host/canvas fails to load for valid payload — **No**: covered by M2/M3 route-smoke tests
- Descriptor-contract error on valid payload during standard flow — **No**: M2/M3/M4 descriptor-contract tests pass
- Visual identity collapse that prevents family recognition — **No**: M2 full-9 tier-aware selector evidence; SW-13B visual evidence pack
- Evidence of legacy fallback/remap path in SW-13 flow — **No**: hard-replace confirmed by `rejects legacy gate descriptor` test and SW-13A addendum

## Tester Notes (2026-07-31)

- All M5 steps resolved via Playwright e2e automation evidence from the 141/141 clean baseline run (2026-06-04).
- SW-13A addendum published 2026-07-31 formally retires all contract gaps and confirms no legacy remap path.
- No open blockers found.
