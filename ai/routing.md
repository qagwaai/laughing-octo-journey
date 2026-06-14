# Routing Architecture

## Overview

The app uses Angular's auxiliary (named) outlet routing to create a multi-panel layout. Routes are defined in `src/app/routed.routes.ts`.

## Outlet Structure

| Outlet | Purpose | Example Content |
| --- | --- | --- |
| Primary (default) | Main 3D canvas scenes | ShipExteriorScene, LoadingScene |
| `left` | Navigation panels, HUD overlays | GuardedLeftMenu, GameMainLeftPanel |
| `right` | Detail panels, 3D viewer | ShipViewerScene, mission boards |

## Route Groups

### Public Routes (`publicRoutes`)
No auth guard. Accessible before login.

| Path | Component | Notes |
| --- | --- | --- |
| `intro` | IntroPage | Landing page |
| `login` | LoginPage | Character login |
| `register` | RegisterPage | New character registration |
| `character-list` | CharacterListPage | Select saved character |
| `character-setup` | CharacterSetupPage | Create new character |
| `character-edit` | CharacterEditPage | Edit existing character |
| `:locale/:characterName` | PublicCharacterProfileScene | Public character showcase |

### Opening Sequence (`openingRoutes`)
Guarded by `authGuard`. Transitional scenes between login and gameplay.

| Path | Component | Notes |
| --- | --- | --- |
| `opening-cold-boot` | OpeningColdBootScene | Boot animation |
| `opening-identity-verification` | OpeningIdentityVerificationScene | ID verification |
| `opening-arrival` | OpeningArrivalScene | Arrival cutscene |

### Game Routes (`gameRoutes`)
Guarded by `authGuard`. Core gameplay.

| Path | Left Outlet | Primary | Right Outlet | Notes |
| --- | --- | --- | --- | --- |
| `stellar-initiation` | - | ShipExteriorScene | - | Entry mission scene |
| `game-main` | GameMainLeftPanel | ShipExteriorScene | - | Main hub with nav |
| `game-main/right:ship-viewer` | GameMainLeftPanel | ShipExteriorScene | ShipViewerScene | Ship viewer overlay |
| `game-main/right:mission-board` | GameMainLeftPanel | ShipExteriorScene | MissionBoardPage | Mission board |
| `game-main/right:ship-hangar` | GameMainLeftPanel | ShipExteriorScene | ShipHangarPage | Ship management |
| `game-main/right:repair-retrofit` | GameMainLeftPanel | ShipExteriorScene | RepairRetrofitPage | Ship repair |
| `game-main/right:market-hub` | GameMainLeftPanel | ShipExteriorScene | MarketHubPage | Market trading |
| `game-main/right:fabrication-lab` | GameMainLeftPanel | ShipExteriorScene | FabricationLabPage | Item crafting |

### Standalone Game Pages
These routes navigate the left outlet independently (replacing the panel):

| Left Route | Purpose |
| --- | --- |
| `stellar-initiation` | Entry mission |
| `mission-board` | Opens game-main + mission-board in right |
| `viewer` | 3D ship viewer |
| `character-profile` | Character details |
| `ship-hangar` | Ship management |
| `repair-retrofit` | Ship repair/upgrade |
| `market-hub` | Market trading |
| `fabrication-lab` | Item crafting |

## Navigation Pattern

The `GuardedLeftMenu` component handles left-outlet navigation via `navigateLeft()`. It constructs outlet configurations like:

```typescript
{ outlets: { left: ['game-main'], right: ['mission-board'] } }
```

Navigation state (playerName, joinCharacter, joinShip) is passed via router state.

## Scene Routing

The `RoutedScene` component wraps the primary `<router-outlet />` with Angular's `@defer` block for lazy-loading scenes with a loading placeholder.

## Mission Context

Routes to `ShipExteriorScene` carry a `missionContext` in navigation state that determines:
- Mission ID (e.g., `FIRST_TARGET_MISSION_ID`)
- Asteroid seed policy
- Ship damage presets
- Starting location