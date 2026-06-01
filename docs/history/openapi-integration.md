# OpenAPI Integration for Item Catalog

## Overview

As of 2026-05-16, the project now sources all in-game item definitions (raw materials, manufactured items, ship items, etc.) from the backend, using the canonical OpenAPI contract at:

- http://localhost:3000/openapi.yaml (preferred runtime source)

## Key Changes

- All item types, display names, and properties are now fetched from the backend `/items` endpoint at app startup.
- The in-memory item catalog is the source of truth for all item lookups, fabrication, and inventory logic.
- Hardcoded item lists and definitions in the codebase have been removed or migrated to backend-driven data.
- If an item is missing from the backend contract, it must be flagged for remediation with the backend team.

## Migration Steps

1. **Centralized Fetch:**
   - On app startup, the Angular service `ItemCatalogService` fetches the canonical item list from `/items`.
   - The item list is cached in memory for the session and invalidated on logout.
2. **Codebase Refactor:**
   - All static item lists, enums, and hardcoded definitions have been replaced with lookups from the item catalog service.
   - Fabrication, repair, and inventory logic now reference backend-driven item data.
3. **Testing:**
   - Playwright and unit tests have been updated to use backend-driven item data.
   - Tests will fail if required items are missing from the backend contract.

## Developer Notes

- The OpenAPI contract is the single source of truth for item schemas and endpoints.
- See `src/app/services/item-catalog.service.ts` for the integration entry point.
- For backend contract changes, update the OpenAPI YAML and notify the frontend team.

## Catalog Gap Audit

To proactively detect missing backend items (before players hit missing-item toasts), run:

```bash
npm run catalog:audit
```

What this audit does:

- Scans non-test frontend source for required item-type references.
- Fetches backend catalog data from `http://localhost:3000/items` by default.
- Prints missing item types with source references for backend follow-up.

Useful overrides:

- `CATALOG_SERVER_URL` (default: `http://localhost:3000`)
- `CATALOG_ITEMS_ENDPOINT` (default: `/items`)

Example:

```bash
CATALOG_SERVER_URL=http://localhost:3000 CATALOG_ITEMS_ENDPOINT=/items npm run catalog:audit
```

---

_Last updated: 2026-05-16_

### As of 2026-05-16, the following items are required by the frontend and must exist in the backend item catalog:

- 3d-printer
- conduit-seals
- expendable-dart-drone
- polymer

All polymer variants are now consolidated to a single canonical "polymer" item. Copper and iron raw/ore aliases are reconciled to "copper" and "iron".

If any of these are missing, the audit will report them for backend remediation.
