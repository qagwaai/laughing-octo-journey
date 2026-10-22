# laughing-octo-journey

This is a template to get started with Angular Three.

## OpenAPI Integration (2026-05)

- All in-game item definitions (raw, manufactured, ship, etc.) are now sourced from the backend using the canonical OpenAPI contract.
- See [docs/openapi-integration.md](docs/openapi-integration.md) for migration details and developer notes.

## AI Guide

- For AI assistant context, commands, and project conventions, see [AGENTS.md](AGENTS.md).

## Getting Started

- Clone this repository and run `npm install` to install the dependencies.
- Run `npm start` to start the development server.
- Run `npm run start:host` to bind the development server to all network interfaces, then open `http://<your-computer's-LAN-IP>:4200` from another device on the same network. Allow port 4200 through your firewall if needed; this does not expose the app to the public internet.

### Game settings

Open **Settings** (the gear icon immediately above **Logout**) in the operations
menu. Settings opens only in the left pane, leaving the current 3D scene in place.
Public pages also have a small gear at the upper-right of the left pane, available
without logging in. Public Settings includes a Back button instead of the game menu.
**Show 3d performance graphs** toggles graphs across all 3D scenes immediately.
It defaults to off, remains in effect while navigating and logging in, and resets
on logout or page refresh. The preference is not stored.

See [Game settings implementation and validation](docs/game-settings-2026-10-22.md)
for the final behavior, implementation details, and session validation evidence.

### Pane splitter

The divider has three stacked icon buttons: **Show all left**, **Reset split to
50/50**, and **Show all right**. Maximizing a pane hides the other pane while
keeping the divider and all three controls on-screen. Drag anywhere on the
divider below the buttons with a mouse, finger, or pen to restore either pane.
Double-click the divider to return to an equal split.

The draggable rail is 32px wide on desktop and 48px on touch devices or screens
up to 640px wide, with 44px touch buttons. Keyboard users can focus the separator
and use Left/Right arrows to resize in 5% steps, Home to show all right, and End
to show all left. Collapsed panes are excluded from keyboard navigation.

### Strict Dev Server (fail-closed serving)

`npm start` runs `ng serve` through a local wrapper builder,
[`tools/strict-dev-server`](tools/strict-dev-server/index.js) (wired up in
`angular.json`). While the latest rebuild is failing, the server returns a
**503 error page for every request** instead of silently serving the last
successful (stale) bundle to new page loads. The error page auto-reloads every
2 seconds and recovers on its own once the build is green.

> **Upgrade caveat:** the wrapper vendors a copy of the stock dev-server
> options schema at `tools/strict-dev-server/schema.json`. After upgrading
> `@angular/build`, re-copy it:
>
> ```bash
> cp node_modules/@angular/build/src/builders/dev-server/schema.json tools/strict-dev-server/schema.json
> ```

## Tooling Commands

- `npm run lint` - Lint TypeScript sources (app + e2e + top-level TS configs)
- `npm run lint:fix` - Apply safe ESLint fixes
- `npm run typecheck` - Typecheck app and Vitest specs
- `npm run typecheck:templates` - Angular template typecheck via `ng build`
- `npm run format:check` - Prettier check for html/css/json/markdown scope
- `npm run format:check:ts` - Optional wider TS/JS Prettier check
- `npm run test:spec -- src/path/to/your.vitest.ts` - Focused Vitest file run
- `npm run e2e:spec -- e2e/tests/your.spec.ts` - Focused Playwright spec run
- `npm run verify:quick` - Quick local gate (`lint + typecheck`)

### Dependency Security

Angular framework packages, `@angular/compiler-cli`, and `@angular/localize`
are pinned to `21.2.25`. Upgrade these together, including animations, forms,
and both platform-browser packages: their exact-version peer dependencies make
individual framework bumps uninstallable. CLI/build and Material/CDK have
separate compatible version ranges and are not part of this framework patch.
Validate coordinated updates with `npm ci`, `npm run typecheck`, `npm run build`,
`npm run test:ci`, and `npm run e2e -- --reporter=line --workers=1 --retries=0`.

CI installs the lockfile with `npm ci --ignore-scripts` and runs `npm audit --audit-level=high`.
CLI `21.2.26` brings MCP SDK `1.31.0` for
[GHSA-6qxp-vccf-f47h](https://github.com/advisories/GHSA-6qxp-vccf-f47h).
The lockfile also resolves `source-map-js` to `1.2.2` for
[GHSA-68fv-2mgg-jv7q](https://github.com/advisories/GHSA-68fv-2mgg-jv7q);
keep this transitive patch when regenerating the lockfile.
The npm override for `piscina` pins the patched `5.3.2` release for
[GHSA-67c8-pqhq-4rmx](https://github.com/advisories/GHSA-67c8-pqhq-4rmx) without downgrading Angular.
Remove this override once `@angular/build` requires a patched Piscina release, then regenerate the lockfile
and verify the audit and build. Avoid `npm audit fix --force`, which can select a breaking Angular downgrade.

## E2E Testing Strategy

E2E tests are organized into **four partitions** for focused iteration and faster developer feedback:

### Partitions

1. **auth-route** (21 tests) — Auth & locale flows
   - `npm run e2e:auth-route`
   - Tests login, registration, and locale-specific auth behavior

2. **viewer-3d** (61 tests) — Rendering & 3D scene interaction
   - `npm run e2e:3d`
   - Tests viewer rendering, viewer-ships, planet zoom, and ship-exterior flight/persistence

3. **stateful-gameplay** (74 tests) — Game state & workflows
   - `npm run e2e:stateful`
   - Tests character lifecycle, mission board, market hub, repair, print queue, and first-target progression

4. **full suite** (156 app tests + setup) — All tests
   - `npm run e2e:full` or `npm run e2e`
   - Required for merge gate; use this to catch cross-partition issues

### Partition Gate

A partition enforcement gate (`npm run e2e:partition:check`) runs automatically before every `npm run build` and `npm run e2e:*` command. The gate ensures:

- Every new spec is assigned to exactly one partition
- No unclassified or multiply-assigned specs break builds

If you add a new e2e test:

1. Save the spec file in `e2e/tests/`
2. The gate will fail with clear guidance on which partition it should join
3. Update the patterns in `scripts/check-e2e-partitions.mjs` to include your spec name
4. Re-run build or e2e command to confirm the gate passes

### Recommended Workflow

- **Local development**: Run your targeted partition (`e2e:auth-route`, `e2e:3d`, or `e2e:stateful`)
- **Pre-commit**: Run the full suite (`e2e:full`) to catch cross-partition breakage
- **CI**: Full suite is the merge gate

## SW-13 Stabilization Governance

For PRs touching SW-13 stabilization scope (stateful gameplay tests, readiness assertions, viewer harness/spec cleanup, or governance docs):

1. Follow the reviewer checklist:
   - [docs/planning/sw-13-closure/sw-13-reviewer-governance-checklist-2026-07-16.md](docs/planning/sw-13-closure/sw-13-reviewer-governance-checklist-2026-07-16.md)
2. Complete the SW-13 section in the PR template:
   - [.github/pull_request_template.md](.github/pull_request_template.md)
3. Update governance adoption evidence:
   - [docs/planning/sw-13-closure/sw-13-governance-adoption-log-2026-07-20.md](docs/planning/sw-13-closure/sw-13-governance-adoption-log-2026-07-20.md)
4. Follow contributor governance guidance:
   - [CONTRIBUTING.md](CONTRIBUTING.md)

## Features

- Angular 21
- Angular Three v3
- THREE.js 0.171
- `.glsl` loader setup
- Tailwind CSS
- Prettier

## Character Setup UX

When saving from `left:character-setup`, a successful backend response now automatically navigates to
`left:character-list`.

- Applies to both create and edit save flows.
- Starter-ship provisioning still runs for newly created characters.
- Regression coverage: `e2e/tests/character-add.spec.ts`, `e2e/tests/character-edit.spec.ts`

## Scene Route Label Ownership

Route labels rendered with `app-current` are owned by individual scene components, not by the routed scene shell.

- Shell responsibility: `src/app/routed-scene.ts` renders `<router-outlet />` and loading fallback only.
- Scene responsibility: each canvas scene template places its own `app-current` marker so overlays can be positioned per scene (for example, cold-boot HUD avoids cockpit crack overlap).

## Opening Sequence: Cold Boot

The opening sequence is split across both panes:

- Left pane narrative page: `opening-cold-boot` outlet route
- Right pane Angular Three scene: `opening-cold-boot` primary route

The sequence now runs as a timed, staged reveal shared across both panes:

- Stage 1: blackout text and first BIOS line
- Stage 2: first view + debris field + additional HUD checks
- Stage 3: AI awakening transmission

Audio hooks are intentionally gated behind a user gesture button in the left pane (`Enable Audio Hooks`) to satisfy browser autoplay rules.

Layered cinematic audio now includes:

- Looped reactor thrum bed
- Looped breathing bed
- HUD flicker static bursts
- AI awakening cue with filtered transmission playback

Content is centralized in a variant/localization-ready model:

- `src/app/model/opening-sequence.ts`
- `src/app/model/opening-sequence.locale.ts`

Both narrative copy and Cold Boot page UI labels (button text, audio status labels, and tooltip strings) are now externalized in the locale catalog file.

Current variants:

- `cold-boot` (default)
- `cold-boot-distress`

Select variants via query string:

- `/opening-cold-boot(left:opening-cold-boot)?variant=cold-boot-distress`

Use the top nav `cold boot` link, or open:

- `/opening-cold-boot(left:opening-cold-boot)`

Implementation files:

- Opening page content: `src/app/page/opening/cold-boot.ts`
- Opening page template/styles: `src/app/page/opening/cold-boot.html`, `src/app/page/opening/cold-boot.css`
- Reusable HUD overlay: `src/app/scene/hud/hud-overlay.ts`
- Reusable cockpit glass/crack layer: `src/app/scene/hud/cracked-cockpit-window.ts`
- Cold Boot scene composition: `src/app/scene/hud/cold-boot-hud-scene.ts`
- Audio hooks service: `src/app/services/opening-audio.service.ts`

## License and Commercial Use

This repository is provided under an **All Rights Reserved** model.

- See [LICENSE](LICENSE) for binding legal terms.
- See [NOTICE](NOTICE) for owner and commercial licensing contact details.
- Contributions are governed by [CONTRIBUTING.md](CONTRIBUTING.md).
- Third-party components are tracked in [THIRD_PARTY_LICENSES.md](THIRD_PARTY_LICENSES.md).

Commercial use is prohibited unless you obtain a separate written commercial license from the repository owner.
For commercial licensing requests, contact: qagwaai@gmail.com

my notes:
npx playwright test e2e/tests/cold-boot-asteroid-parity.spec.ts --project=chromium --headed --reporter=line
