Begin implementation of docs/planning/ship-exterior-bare-scene-testing-separation-plan-2026-09-01.md.

Phase 0 is complete and the full Playwright suite is green. Preserve all stabilization behavior documented in sections 10.5 and 10.6.

Start with the smallest safe implementation slice:

1. Review current canonical mission evaluators, MissionGateSimulator, scene test API, production manufacture/repair paths, and their tests.
2. Add only characterization coverage needed to protect state publication, persistence, refresh, and synchronization boundaries. Do not canonize duplicated simulator rules.
3. Implement Phase 2 by delegating manufacture, repair, and debris progression to the canonical domain evaluators.
4. Remove the debris no-op behavior without reintroducing simulation as fixture setup.
5. Preserve the existing browser API shape temporarily if needed for incremental compatibility.
6. Keep persisted mission keys and state shapes unchanged.
7. Do not yet perform the broader facade or E2E adapter extraction unless it is necessary to complete canonical delegation correctly.
8. Update the plan with completed work and remaining phases.

Important regression constraints:

- Do not restore simulateDebrisCollection as debris fixture setup.
- Wait for authoritative fixture identities rather than transient local fallbacks.
- Use SocketIOMock.connected for mocked login readiness.
- Reuse ensureCharacterListReady for character-list recovery.
- For timer-driven angular-three tests, prefer clock.fastForward() and stable UI assertions over clock.runFor() or fixed sleeps.
- Preserve existing unrelated worktree changes.

Validate with focused Vitest tests first, then:
- the simulation-consuming Playwright specs;
- npm run typecheck;
- npm run lint;
- npm run build.

Run broader E2E coverage only after focused tests pass. Report exact architectural changes, validation results, and which plan acceptance criteria are complete.