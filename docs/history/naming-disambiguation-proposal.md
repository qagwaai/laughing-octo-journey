# Naming Disambiguation Proposal

## Goal

Make file navigation unambiguous by ensuring feature intent is visible in the filename itself.

## Proposed Suffix Conventions

- Page components: *.page.ts
- Scene components: *.scene.ts
- Reusable UI components: *.component.ts
- Domain services: *.service.ts
- Route configuration modules: *.routes.ts
- Contract types and DTO modules: *.contract.ts or *.dto.ts (choose one per folder and keep it consistent)

## Scope Rules

- Apply to new files immediately.
- Apply to existing files incrementally per feature folder to minimize churn.
- Keep test suffixes aligned to source names (for example: *.page.spec.ts).

## Rollout Plan

1. Start with one feature folder at a time (public, character, game, scene).
2. Use semantic rename tooling to preserve import correctness.
3. After each folder migration, run focused specs and app typecheck.
4. Avoid mixing renames with behavior changes in the same changeset.

## First Safe Candidates

- src/app/page/public/login.ts -> src/app/page/public/login.page.ts
- src/app/page/public/registration.ts -> src/app/page/public/registration.page.ts
- src/app/page/game/mission-board.ts -> src/app/page/game/mission-board.page.ts
