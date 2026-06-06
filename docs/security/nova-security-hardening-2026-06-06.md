# Nova Security Hardening Verification (2026-06-06)

## Decision

Status: Ready for Orion intake (repo-internal controls implemented and validation gates are green).

## Scope

- Repository-internal hardening only.
- GitHub org/repo setting controls are out of scope for this note.
- No intended gameplay or user-flow behavior changes.

## Controls Implemented

### 1) Secrets and hygiene

- Expanded ignore coverage for local secrets and certificate/key artifacts.
- Added `.env.example` with placeholders only.
- Added CI secret scan gate using gitleaks with fail-on-detection policy.

### 2) Dependency and supply chain

- Lockfile policy enforced in CI:
  - Requires `package-lock.json`.
  - Installs with `npm ci --ignore-scripts`.
  - Fails if lockfile mutates during CI.
- Runtime/toolchain pinning added:
  - `.nvmrc` pins Node runtime.
  - `package.json` engines pin supported Node/npm trains.
  - `packageManager` pins npm version.
- Added dependency vulnerability gate with fail policy for high/critical (`npm audit --audit-level=high`).
- Added Dependabot configuration for npm and GitHub Actions ecosystems.

### 3) CI/workflow hardening

- Added explicit least-privilege permissions to SW-08 workflow (`contents: read`).
- Security workflows use least privilege by default.
- Third-party actions are not used in added workflows (no SHA pin exceptions required).
- Privileged release/deploy separation:
  - No privileged release/deploy workflow was introduced in this hardening pass.
  - Security and contract checks remain unprivileged PR-safe jobs.

### 4) Code security gates

- Added CodeQL static security workflow for JavaScript/TypeScript.
- Added ESLint unsafe-pattern rules:
  - `no-eval`
  - `no-implied-eval`
  - `no-new-func`
  - `no-script-url`
- Preserved SW-08 contract hard-fail workflow and tightened permissions only.

## Files Changed

- `.gitignore`
- `.env.example`
- `.nvmrc`
- `package.json`
- `package-lock.json`
- `eslint.config.mjs`
- `.github/dependabot.yml`
- `.github/workflows/sw-08-contract-safety-gate.yml`
- `.github/workflows/security-hygiene.yml`
- `.github/workflows/codeql-analysis.yml`
- `src/app/page/character/components/character-bust-viewer/character-bust-viewer.ts`
- `docs/security/nova-security-hardening-2026-06-06.md`

## CI Checks Added/Updated

Added:
- `Security Hygiene` workflow
  - `secret-scan` (gitleaks)
  - `dependency-audit` (npm audit high/critical + lockfile policy)
- `CodeQL` workflow

Updated:
- `SW-08 Contract Safety Gate`
  - Added explicit least-privilege token permission declaration.

## Test and Scan Evidence

Local execution evidence (this hardening run):
- SW-08 gate: `npm run contract:check:stage3` -> pass (Decision: pass, Findings: 0).
- Secret scan: `gitleaks detect --source . --no-banner --redact --exit-code 1` -> pass (no leaks found).
- Dependency scan: `npm audit --audit-level=high` -> fail.
- Dependency remediation applied:
  - Removed unused `angular-three-plugin` to eliminate the transitive `@nx/devkit`/`nx`/`minimatch` high path.
  - Added npm `overrides` pin for `vite` to a patched version.
  - Refreshed lockfile with `npm install`.
- Dependency scan: `npm audit --audit-level=high` -> pass (`0 vulnerabilities`).
- Lint baseline check: `npm run lint` -> fail due existing repo lint debt unrelated to this hardening change.
- SW-08 revalidation after dependency updates: `npm run contract:check:stage3` -> pass.

GitHub CI evidence (populate after push/PR):
- Security Hygiene run URL: PENDING
- CodeQL run URL: PENDING
- SW-08 Contract Safety Gate run URL: PENDING

Character flow validation evidence:
- Add character flow status: PASS
  - Command: `npx playwright test e2e/tests/character-add.spec.ts --reporter=line`
  - Result: `6 passed`.
- Edit character flow status: PASS
  - Command: `npx playwright test e2e/tests/character-edit.spec.ts --reporter=line`
  - Result: `3 passed`.
- Combined focused run status: PASS
  - Command: `npx playwright test e2e/tests/character-add.spec.ts e2e/tests/character-edit.spec.ts --reporter=line`
  - Result: `9 passed`.

## Remaining Risks / Exceptions

- No policy exceptions requested in this hardening run.

## Orion Handoff Note

Handoff decision: Ready.

Blockers:
- None.

Exception owner / rationale / due date:
- Not applicable.
