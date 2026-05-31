# Model Folder Reorganization Plan

## Goal

Reduce namespace clutter under src/app/model by separating contracts, domain entities, UI view models, and utility modules.

## Target Structure

- src/app/model/contracts
  - Socket event request/response payload types and event constants.
- src/app/model/domain
  - Core gameplay entities and state models used across features.
- src/app/model/view
  - UI-facing projection types and formatting helpers.
- src/app/model/catalog
  - Catalog-style static datasets (mission metadata, printable items, locale keyed content maps).
- src/app/model/math
  - Units, geometry, kinematics, and conversion helpers.
- src/app/model/shared
  - Cross-cutting primitives that do not belong to one domain (triples, narrow utility types).

## Migration Order (No-Break)

1. Create folders and add index barrels in each new subfolder.
2. Move pure utility/math files first (lowest dependency fan-in).
3. Move catalog/static-data files next and update direct imports.
4. Move socket contracts into contracts last among shared modules to avoid wide churn early.
5. Move remaining domain entities and update imports via barrels.
6. Run app typecheck after each micro-batch and keep commit scope small.
7. Remove temporary compatibility re-exports only after all imports are updated.

## Guardrails

- Keep filenames unchanged during moves to reduce cognitive overhead.
- Do not mix semantic refactors with path moves in the same change.
- Preserve public symbol names to avoid template/type regressions.
- Validate template-sensitive changes with full app build when model types are used in templates.

## First Batch Recommendation

- Move:
  - src/app/model/triple.ts -> src/app/model/shared/triple.ts
  - src/app/model/kinematics.ts -> src/app/model/math/kinematics.ts
  - src/app/model/drive-profile.ts -> src/app/model/math/drive-profile.ts
- Add compatibility re-export stubs in previous paths for one migration cycle.
- Update imports in touched files and run focused specs for market-hub, game-join, and ship-hangar.
