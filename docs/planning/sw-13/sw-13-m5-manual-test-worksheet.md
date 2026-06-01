# SW-13 M5 Manual Test Worksheet (Nova)

Date: 2026-05-30  
Scope: SW-13 M5 manual validation for current Nova UI functionality  
Feature: SW-13 External Object Presentation Expansion

## Run Setup

- Tester: qagwaai
- Build/Branch: ____________________
- Browser: chrome
- Locale baseline: `en` then `it`
- Start time: ____________________
- End time: ____________________

## Pass/Fail Rule

- Mark each step Pass/Fail.
- Capture screenshot or short clip for any Fail.
- Any blocker in authentication, navigation, scene load, or descriptor-contract behavior is M5-blocking.

## Test Sequence

| ID | Action | Expected Result | Actual Result | Pass/Fail | Evidence |
| --- | --- | --- | --- | --- | --- |
| M5-01 | Open app in clean browser session. | Login page renders with player/password/locale controls. |  | Pass |  |
| M5-02 | Verify login form validation before submit. | Submit remains blocked until valid input. |  | Pass |  |
| M5-03 | Login with valid user in `en`. | Route transitions to character list. |  | Pass |  |
| M5-04 | Logout and login again in `it`. | Italian labels render where localized; fallback text remains usable. |  | Pass |  |
| M5-05 | On character list, run load/refresh and inspect rows. | Characters load without blocking error. |  | Pass |  |
| M5-06 | Open create/edit flow and return. | Navigation returns cleanly to character list. |  | Pass |  |
| M5-07 | Open delete dialog and cancel. | Dialog closes; no character removed. |  | Pass |  |
| M5-08 | Join game with valid character. | Route reaches game-main; no blocker errors. |  | Pass |  |
| M5-09 | Verify viewer entry control in game-main. | Viewer entry is available post-join. |  | Pass |  |
| M5-10 | Open Viewer list and select a system (for example, Sol). | Route enters viewer-scene; scene host/canvas visible. |  |  |  |
| M5-11 | Perform hover/rotate/pan/zoom interactions for 60s. | Scene remains responsive and stable with no fatal error overlay. |  |  |  |
| M5-12 | Confirm scene context text (system naming) remains coherent. | System context remains visible and not corrupted after interactions. |  |  |  |
| M5-13 | Verify family readability sweep (ships/stations/asteroids/debris/gates when present). | Families are visually distinguishable; no identity collapse. |  |  |  |
| M5-14 | Verify gate legend cue presence when gate descriptors are present. | Gate legend cue is visible and consistent. |  |  |  |
| M5-15 | Focus/select gate and inspect detail rows. | Gate approach metadata rows render consistently. |  |  |  |
| M5-16 | Observe hazard/escalation metadata values in gate details. | Values are stable across reselection and navigation. |  |  |  |
| M5-17 | Run dense-scene observation for 2-3 minutes (continuous movement). | No crash, no frozen input, no contract error for valid payloads. |  |  |  |
| M5-18 | Navigate viewer-list -> viewer-scene -> game-main -> viewer-scene again. | Repeat transitions remain stable and deterministic. |  |  |  |
| M5-19 | Repeat one scene entry in `it`. | Localization remains non-blocking in scene flows. |  |  |  |
| M5-20 | Watch for legacy behavior during full run. | No legacy descriptor/fallback remap behavior appears. |  |  |  |

## M5 Evidence Pack Checklist

- [ ] Screenshot: login baseline
- [ ] Screenshot: character list
- [ ] Screenshot: game-main with viewer entry
- [ ] Screenshot: viewer list before selection
- [ ] Screenshot: viewer scene with legend
- [ ] Screenshot: gate detail metadata rows
- [ ] Short clip (60-120s): dense-scene interaction
- [ ] Notes captured for any ambiguity, stutter, descriptor-contract error, or locale issue

## Blocking Criteria

- Authentication or join-game flow blocked
- Viewer route transition blocked
- Scene host/canvas fails to load for valid payload
- Descriptor-contract error on valid payload during standard flow
- Visual identity collapse that prevents family recognition
- Evidence of legacy fallback/remap path in SW-13 flow

## Tester Notes

- Issue summary: _________________________________________________
- Repro steps: _________________________________________________
- Timestamps: _________________________________________________
- Console/network observations: _________________________________________________
