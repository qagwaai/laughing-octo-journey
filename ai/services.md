# Services Architecture

## Overview

The application uses Angular injectable services for shared state management, socket communication, and business logic. Services are provided at the root level (`providedIn: 'root'`) and rely on Angular Signals for reactive state.

## Service Categories

### Socket Services

| Service | File | Purpose |
| --- | --- | --- |
| `SocketService` | `services/socket.service.ts` | Base transport layer wrapping `socket.io-client` |
| `SocketLifecycleService` | `services/socket-lifecycle.service.ts` | Connection lifecycle tied to auth state |
| `ShipExteriorSocketService` | `services/ship-exterior-socket.service.ts` | Ship scene socket operations |
| `SceneGraphSocketService` | `services/scene-graph-socket.service.ts` | Scene graph synchronization |

### Session & Auth

| Service | File | Purpose |
| --- | --- | --- |
| `SessionService` | `services/session.service.ts` | Active character, ship, auth token state |
| `AuthGuard` | `guards/auth.guard.ts` | Route guard for authenticated routes |

### Scene State

| Service | File | Purpose |
| --- | --- | --- |
| `ShipExteriorAsteroidStateService` | `services/ship-exterior-asteroid-state.service.ts` | Asteroid scan samples |
| `ShipExteriorMissionStateService` | `services/ship-exterior-mission-state.service.ts` | Mission gate progression |
| `FloatingDebrisStateService` | `services/floating-debris-state.service.ts` | Floating debris items |
| `LeftPanelNavigationContextService` | `services/left-panel-navigation-context.service.ts` | Menu mode, player context |

### Market & Trading

| Service | File | Purpose |
| --- | --- | --- |
| `MarketHubService` | `services/market-hub.service.ts` | Market listing CRUD |
| `MarketPricingService` | `services/market-pricing.service.ts` | Price calculation, currency conversion |

### Catalog & Reference Data

| Service | File | Purpose |
| --- | --- | --- |
| Mission catalog | `model/catalog/mission-catalog.ts` | Mission definitions |
| Item catalog | `model/catalog/` | Item definitions, craftable items |

## Signal-Based State Pattern

Services use Angular Signals for reactive state:

```typescript
// Read state
const activeShip = sessionService.activeShip();

// Write state
sessionService.setActiveShip(ship);

// Computed derived state
protected shipDisplayName = computed(() => this.activeShip()?.name ?? 'Unknown');

// Side effects
effect(() => {
  if (this.activeShip()) {
    this.loadShipInventory();
  }
});
```

## State Persistence

Scene state services support persistence:
- `saveState()` / `loadState()` - Persist to localStorage
- State keyed by mission ID and character ID
- Enables mission progression tracking across sessions

## Provider Registration

Services are registered in `app.config.ts` providers array. The Angular Three renderer provider (`provideNgtRenderer`) is configured with PMREMGenerator and RoomEnvironment for studio-style lighting.

## Service Injection Pattern

Components use the `inject()` function for dependency injection:

```typescript
@Component({ ... })
export class MyComponent {
  private sessionService = inject(SessionService);
  private socketService = inject(ShipExteriorSocketService);
}
```

This is preferred over constructor injection for standalone components.