# laughing-octo-journey

This is a template to get started with Angular Three.

## AI Guide

- For AI assistant context, commands, and project conventions, see [AGENTS.md](AGENTS.md).

## Getting Started

- Clone this repository and run `npm install` to install the dependencies.
- Run `npm start` to start the development server.

## Features

- Angular 19
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
