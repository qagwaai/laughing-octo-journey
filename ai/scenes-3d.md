# 3D Scenes Architecture

## Overview

3D rendering is powered by Angular Three (`angular-three`), a React Three Fiber-inspired library adapted for Angular. Scenes are structured as Angular components with Three.js primitives as child components.

## Scene Components

### ShipExteriorViewScene (`src/app/scene/ship-exterior-view.ts`)

The largest and most complex component (~3400 lines). This is the main gameplay scene controller responsible for:

- Asteroid spawning, scanning, and targeting
- Mission gate progression tracking
- Ship flight physics and camera control
- Floating debris management
- Tractor beam animations
- Launch item actions
- Route feed visualization (gates, stations, encounter ships)
- Frame pressure monitoring and quality scaling
- Socket synchronization for all scene state

#### Controller Pattern

Rather than putting all logic in the component class directly, the scene delegates to specialized controller classes:

| Controller | Responsibility |
| --- | --- |
| `ShipExteriorBootstrapController` | Initial scene seeding, asteroid generation |
| `ShipExteriorFlightController` | Ship movement, camera rotation, boost |
| `ShipExteriorLaunchController` | Launch item targeting and execution |
| `ShipExteriorMissionProgressController` | Mission gate step evaluation |
| `ShipExteriorCelestialBodyController` | Celestial body persistence |
| `ShipExteriorSessionController` | Target hold state |
| `ShipExteriorStateFacade` | Ship inventory state reconciliation |
| `FloatingDebrisController` | Debris spawning and collection |
| `ShipDamageController` | Ship hull damage visualization |
| `HotkeyFlashController` | Keyboard hotkey UI feedback |
| `LaunchToastController` | Launch action toast notifications |
| `TractorBeamAudioController` | Tractor beam sound effects |
| `FramePressureSampler` | FPS monitoring for quality scaling |

#### Asteroid Rendering Pipeline

1. Asteroids are seeded based on `ShipExteriorViewSeedPolicy` from mission context
2. Each asteroid has an `AsteroidScanSample` with material profile, PBR params, and SW13B metadata
3. Render tiers assigned dynamically: `hero`, `standard`, `background` based on distance and scan state
4. Quality scaler adjusts tier caps based on frame pressure

### ShipViewerScene (`src/app/scene/ship-viewer.ts`)

A 3D ship model viewer for examining ship models. Uses:
- `NgtArgs` for Three.js scene graph
- `NgtsOrbitControls` for camera rotation
- GLTF model loading from `public/models/`

### LoadingScene (`src/app/scene/loading-scene.ts`)

Placeholder scene shown during route transitions as a `@placeholder` in `RoutedScene`.

## 3D Component Library

Reusable Three.js node components live in `src/app/component/`:

| Component | Purpose |
| --- | --- |
| `Asteroid` | Asteroid mesh with PBR materials, scan state |
| `BackgroundStars` | Starfield background |
| `Sol` | Sun/light source component |
| `FloatingDebrisNode` | Debris item 3D representation |
| `ShipExteriorRouteFeedLayer` | Route visualization (gates, stations) |

## External Object Descriptors

The `ExternalObjectDescriptor` system (`src/app/model/external-object-descriptor.ts`) defines how 3D objects are rendered:

- `objectFamily` - Model family (e.g., `asteroid`, `ship`, `debris`)
- `domain` - Scene domain context
- `displayLabel` - UI label
- `modelPath` - Path to GLTF/GLB model
- Render profile includes color, emissive, geometry segments, scale

## SW13B Asteroid System

Asteroids use a seed-based generation system with:
- Seed IDs encoding tier info (B=baseline, H=hero)
- Generator version tracking
- Parameter bundle hashing for reproducibility
- Profile presets for visual consistency
- Surface targeting (SV, SEV)
- Validation status tracking

## Flight System

The `ShipExteriorFlightController` manages:
- Keyboard input (W/S forward-back, A/D strafe, Space/Ctrl vertical, Q/E roll, Shift boost)
- Mouse look with pointer lock
- Camera orientation (yaw, pitch, roll)
- Position tracking with checkpoint synchronization to the server
- Configurable mouse sensitivity with min/max bounds
- Pitch limits to prevent gimbal lock

## Quality Scaling

The `FramePressureSampler` monitors frame timing and adjusts:
- Asteroid render tier caps (fewer hero/standard asteroids when frame pressure is high)
- Geometry detail levels
- The `qualityScaler` signal ranges from 0 to 1 and feeds into tier assignment logic

## Scene State Management

Scene state is managed through dedicated state services:

| Service | State Managed |
| --- | --- |
| `ShipExteriorAsteroidStateService` | Asteroid scan samples |
| `ShipExteriorMissionStateService` | Mission gate progression |
| `FloatingDebrisStateService` | Floating debris items |
| `SessionService` | Active ship, character, auth token |
| `LeftPanelNavigationContextService` | Menu mode, navigation context |

## Renderer Configuration

The Angular Three renderer is configured in `app.config.ts` via `provideNgtRenderer()`. The scene uses:
- PMREMGenerator for environment mapping
- RoomEnvironment for studio-style lighting
- OnPush change detection strategy throughout
- `CUSTOM_ELEMENTS_SCHEMA` for Three.js custom elements