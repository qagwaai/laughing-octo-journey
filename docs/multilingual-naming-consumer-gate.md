# Multilingual naming consumer gate

## Authority consumed

Inspected the served sources on 2026-11-06 UTC. Schemas alone define API fields;
module version and HTTP validators are source-identification evidence, not Git revisions.

| Exact URL                                                                    | Revision evidence                                                                                |
| ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| http://localhost:3000/openapi/solarsystem/openapi.yaml                       | info.version `4.0.0`; ETag `W/"6477-1a1ae862613"`; Last-Modified `Fri, 06 Nov 2026 01:43:09 GMT` |
| http://localhost:3000/openapi/schemas/solar-system-get-response.schema.json  | ETag `W/"3821-1a1ae48fb75"`; Last-Modified `Fri, 06 Nov 2026 00:36:20 GMT`                       |
| http://localhost:3000/openapi/schemas/solar-system-list-response.schema.json | ETag `W/"1928-1a1ae48fb68"`; Last-Modified `Fri, 06 Nov 2026 00:36:20 GMT`                       |
| http://localhost:3000/openapi/schemas/solar-system-list-request.schema.json  | ETag `W/"a64-1a1ae862605"`; Last-Modified `Fri, 06 Nov 2026 01:43:09 GMT`                        |

No Git SHA was supplied. Both response schemas independently require
`displayName: string`, `settlementName: string | null`, and `aliases: string[]`.
`catalogName` is optional and nullable in each schema; it is not made required locally.
The existing frontend lacked settlement/alias fields and reused the list summary
as the get summary. These naming discrepancies are addressed; no disagreement
between the two served naming definitions was found. Other, unrelated legacy
model differences are outside this naming-only alignment. No root/GitHub drift
comparison was run: these modular schemas are the requested authority.

The request schema explicitly permits any non-whitespace length. It specifies
literal substring matching across IDs, names, aliases and primary-star metadata;
server normalization is NFC, whitespace collapse and en-US lowercase, without
accent removal, regex interpretation, transliteration or script folding.

## Implementation and boundaries

- Independent get/list naming fields; get omits inherited naming fields before
  declaring its own. Unrelated existing metadata remains shared.
- One standalone OnPush presentation component serves the actual Viewer list and
  solar-system details heading. The get fixture deliberately differs from the list
  label to verify replacement of navigation-state text by the get response.
- `displayName` is interpolated verbatim, not parsed, split or reconstructed.
  Null/incomplete structured names do not change it. A supplied nonblank catalog
  component is suppressed only when the display label exactly matches the catalog
  name or the documented `settlementName (catalogName)` combination.
  No partial settlement/catalog pair is manufactured; aliases are search metadata,
  not extra visible labels.
- `<bdi dir="auto">` and CSS isolation/wrapping preserve source characters, with
  no injected bidi controls, ellipsis, transliteration, or accessibility override.
  Label text is explicitly selectable, including inside list buttons.
- Search retains debounce/paging but has no minimum. Nonblank queries are sent
  unchanged; the frontend does not implement its own matching/folding engine.
- All fixture names, aliases and IDs are test-only synthetic data. No backend,
  catalog refresh, published name, assignment, real ID/data change, or
  `settlementName` rename. No commits.

## Validation

Commands from repository root:

```powershell
npm run test:spec -- src/app/component/solar-system-name.vitest.ts src/app/page/game/viewer.vitest.ts src/app/page/game/solar-system-details.vitest.ts src/app/services/solar-system-correlation.integration.vitest.ts
npm run typecheck
npm run build
npx playwright test --config=e2e/naming.config.ts --reporter=line
npx playwright test e2e/tests/viewer-list.spec.ts --project=chromium --reporter=line
npm run e2e:readiness:check
git --no-pager diff --check
```

Results: 38 focused tests passed; app/spec typing and Angular production/template
build passed; naming matrix 6 passed, 3 native-clipboard cases explicitly skipped;
existing viewer-list regression run 11 passed (includes authentication setup).
Targeted ESLint on all changed TypeScript passed; readiness and build partition
gates passed. A separate Prettier probe reported formatting warnings on touched
files; broad template formatting was not applied.

Playwright 1.64.1, Windows x64, headless:

| Engine   | Version      | Evidence                                               |
| -------- | ------------ | ------------------------------------------------------ |
| Chromium | 156.0.8078.4 | 2 naming tests passed; existing list regression passed |
| Firefox  | 157.0        | 2 naming tests passed                                  |
| WebKit   | 27.2         | 2 naming tests passed                                  |

The repository's production Playwright configuration enables Chromium only;
Firefox/WebKit are supplemental readiness checks in the isolated naming config.
Tests log in and join through the actual Angular screens using deterministic
SocketIOMock authentication/responses, not a standalone demo/harness component.
They cover null settlement names with empty/nonempty aliases, combined labels,
independent get text, one/two-character CJK, Arabic/Latin and Devanagari/Latin,
literal aliases/queries, negative accent/transliteration queries, accessible names,
exact DOM and browser selection text, 90px constrained wrapping with RTL ancestors,
and details at a 640px viewport.

### 2026-11-14 E2E maintenance

The naming test now constrains the flex item itself to 90px, rather than setting
a width that flex growth could override. It verifies the separately rendered
catalog label and complete accessible heading when the intentionally different
get-response display name does not exactly match the suppression cases above.
The updated Chromium naming flow passed as part of the five-test focused run
documented in [Viewer navigation and validation](viewer-architecture-decision.md#ship-hangar-and-viewer-navigation-implemented-2026-11-14).
The prior Firefox, WebKit, and clipboard evidence was not rerun in this session.

### Explicit gaps / next steps

- Native keyboard copy/paste attempts returned an empty input in this headless
  environment across all engines. The cause is not certified. Exact browser
  selection/copy-source text passes; OS clipboard serialization/round-trip does
  **not** have passing evidence. Retained an opt-in test for interactive validation:

  ```powershell
  $env:NAMING_NATIVE_CLIPBOARD = '1'
  npx playwright test --config=e2e/naming.config.ts --headed --grep='native clipboard' --reporter=line
  ```

- No macOS/Linux, real Safari, iOS/Android, installed-browser channel, OS font
  matrix, IME composition, screen-reader speech, or manual visual review evidence.
  Accessible-name assertions are not a full accessibility audit.
- Backend matching is emulated locally from the request schema; no real backend
  naming publication, assignments, auth credentials, or live-data changes were
  exercised. Native clipboard and real supported-platform/manual checks remain
  release-readiness follow-ups, not reasons to activate names or assignments.

## Changed files

- `src/app/model/solar-system-list.ts`
- `src/app/model/solar-system-get.ts`
- `src/app/component/solar-system-name.ts`
- `src/app/component/solar-system-name.vitest.ts`
- `src/app/page/game/viewer.ts`
- `src/app/page/game/viewer.html`
- `src/app/page/game/viewer.vitest.ts`
- `src/app/page/game/solar-system-details.ts`
- `src/app/page/game/solar-system-details.html`
- `src/app/page/game/solar-system-details.css`
- `src/app/services/solar-system-correlation.integration.vitest.ts`
- `e2e/fixtures/solar-system-naming.ts`
- `e2e/tests/viewer-naming.spec.ts`
- `e2e/tests/viewer-list.spec.ts`
- `e2e/naming.config.ts`
- `docs/multilingual-naming-consumer-gate.md`
