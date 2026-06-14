# Project Overview

## Identity

- **Package Name:** `ngt-template`
- **Repository:** `laughing-octo-journey` (GitHub workspace)
- **Version:** 0.0.0
- **Node Runtime:** Node 20.19.x, npm 10.9.x

## What It Is

A browser-based, single-page game application built with Angular 21 + Angular Three. The app renders real-time 3D space scenes (ships, asteroids, celestial bodies) using Three.js via the Angular Three (`@pmndrs`) ecosystem, communicates with a backend server over WebSocket (Socket.IO), and provides a full game UI with left-panel navigation, market systems, mission boards, ship management, and fabrication systems.

## Core Tech Stack

| Layer | Technology |
| --- | --- |
| Framework | Angular 21.2.14 (standalone components, zoneless change detection) |
| Language | TypeScript 5.9.3 |
| 3D Engine | Three.js 0.182.0 via Angular Three (`angular-three`) |
| Physics | Cannon-ES via `angular-three-cannon` |
| Post-processing | `angular-three-postprocessing` |
| Controls | `angular-three-soba` (OrbitControls) |
| Styling | Tailwind CSS 4.3.1 + CSS modules |
| Real-time | `socket.io-client` 4.8.3 |
| State | Angular Signals (reactive) + custom service facades |
| i18n | Custom proxy-based locale system (en, it) |
| Unit/Component Tests | Vitest 4.1.8 + `@analogjs/vitest-angular` |
| E2E Tests | Playwright 1.59.1 |
| Linting | ESLint 10.4.1 |
| Formatting | Prettier 3.8.3 |

## Key Architectural Decisions

1. **Zoneless Change Detection** - The app uses `provideZonelessChangeDetection()` instead of Angular's default Zone.js. This means change detection is driven by signals, not by automatic dirty-checking.

2. **Angular Three (Ngt)** - 3D scenes are rendered as Angular components using the `angular-three` library. The renderer is provided via `provideNgtRenderer()`.

3. **Signal-First State** - All reactive state uses Angular Signals (`signal()`, `computed()`, `effect()`) rather than RxJS Observables for component-level state.

4. **Multi-Outlet Routing** - The app uses Angular's auxiliary routing with three outlets:
   - Primary (default) - main canvas scenes
   - `left` - navigation panels and UI overlays
   - `right` - detail panels, 3D viewer scenes

5. **Socket.IO Central Bus** - All real-time communication flows through `SocketService` and domain-specific socket services (`ShipExteriorSocketService`, `SceneGraphSocketService`).

6. **Mission-Driven Scenes** - 3D scenes are parameterized by "mission context" that controls seeding, objectives, and progression gates.

## Project Structure

```
src/
  app/
    component/     # Reusable Angular components (3D nodes, UI elements)
    guards/        # Route guards (auth)
    i18n/          # Localization system
    mission/       # Mission definitions, gate logic, scene plugins
    model/         # TypeScript interfaces/types for API contracts
    page/          # Route-level page components
      character/   # Character setup/list flows
      game/        # Core gameplay pages (market, missions, ships, etc.)
      opening/     # Opening/cold-boot sequences
      public/      # Login, registration, intro
    scene/         # 3D scene components (ship exterior, viewer, HUD)
    services/      # Injectable services (socket, session, market, etc.)
  assets/          # Static assets
  environments/    # Environment configs
  testing/         # Test utilities
```

## Entry Points

- `src/main.ts` - Application bootstrap
- `src/app/app.config.ts` - Application configuration (providers)
- `src/app/routed.routes.ts` - Route definitions
- `src/app/routed-scene.ts` - Primary scene router outlet wrapper
- `src/app/app.component.ts` - Root component