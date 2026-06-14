# Socket Architecture

## Overview

Real-time communication is the backbone of the game. All client-server communication flows through Socket.IO, managed by a layered service architecture.

## Service Hierarchy

```
SocketService                    (base transport layer)
    │
    ├── SocketLifecycleService   (connection lifecycle management)
    ├── ShipExteriorSocketService (ship scene operations)
    └── SceneGraphSocketService  (scene graph sync)
```

### SocketService (`src/app/services/socket.service.ts`)

The foundational transport layer wrapping `socket.io-client`. Provides:

- `connect(url)` - Establish WebSocket connection
- `disconnect()` - Close connection
- `emit(event, data, callback)` - Fire events with optional ack
- `on(event, handler)` - Subscribe to events (returns unsubscribe fn)
- `once(event, handler)` - One-time subscription
- `getIsConnected()` - Connection state query
- `getConnectionError()` - Error state query

Uses Angular Signals internally for connection state. Auto-reconnect is enabled by default.

### SocketLifecycleService (`src/app/services/socket-lifecycle.service.ts`)

Manages connection lifecycle in response to authentication state. Handles:
- Auto-connect on auth token availability
- Reconnection after token refresh
- Disconnection on logout

### ShipExteriorSocketService (`src/app/services/ship-exterior-socket.service.ts`)

Domain-specific wrapper for ship exterior scene operations. Provides typed emit methods like:
- `emitShipListRequest()`
- `emitCelestialBodyListRequest()`
- `emitLaunchItemRequest()`
- `emitAsteroidScanRequest()`

## Socket Event Contracts

Event names and payload shapes are defined as TypeScript types in `src/app/model/`. The authoritative contract source is the backend OpenAPI spec at `http://localhost:3000/openapi.yaml`.

### Key Request/Response Pairs

| Request Event | Request Type | Response Event | Response Type |
| --- | --- | --- | --- |
| `shipListRequest` | `ShipListRequest` | `shipListResponse` | `ShipListResponse` |
| `shipListByOwnerRequest` | `ShipListByOwnerRequest` | `shipListByOwnerResponse` | `ShipListByOwnerResponse` |
| `itemUpsertRequest` | `ItemUpsertRequest` | `itemUpsertResponse` | `ItemUpsertResponse` |
| `launchItemRequest` | `LaunchItemRequest` | `launchItemResponse` | `LaunchItemResponse` |
| `celestialBodyListRequest` | `CelestialBodyListRequest` | `celestialBodyListResponse` | `CelestialBodyListResponse` |
| `missionUpsertRequest` | `MissionUpsertRequest` | `missionUpsertResponse` | `MissionUpsertResponse` |
| `marketListRequest` | `MarketListRequest` | `marketListResponse` | `MarketListResponse` |
| `characterListRequest` | `CharacterListRequest` | `characterListResponse` | `CharacterListResponse` |

### Correlation IDs

Request-response pairing uses correlation IDs. Each request includes a `correlationId` field, and the corresponding response echoes it back. The `SocketService` manages callback registration keyed by correlation ID.

## Contract Safety

### OpenAPI as Source of Truth

Per AGENTS.md guidance:
- `openapi.yaml` is the only contract authority
- Model types in `src/app/model/` must align with OpenAPI
- Do NOT use alternate contract docs when OpenAPI is available
- If OpenAPI is missing required messaging detail, report it instead of guessing

### Contract Violation Tracking

The ship exterior scene tracks socket contract violations in dev mode:
- `socketContractViolationCounterLine` - Shows violation count per minute
- `socketLastContractViolationOperation` - Last operation that violated
- Timestamps are tracked for debugging correlation mismatches

## Testing Socket Interactions

### E2E Socket Mocking

Playwright tests use a socket mocking fixture:
- `e2e/fixtures/socket-mock.ts` - `SocketIOMock` class
- Intercepts socket events in the browser context
- Allows scripted request-response simulation

### Unit Test Pattern

```typescript
// Mock the socket service
const mockSocketService = {
  emit: vi.fn(),
  on: vi.fn().mockReturnValue(() => {}),
  getIsConnected: () => true,
};

// Then spy on emit calls
expect(mockSocketService.emit).toHaveBeenCalledWith('launchItemRequest', expectedPayload);
```

## Best Practices from AGENTS.md

1. Keep socket event names aligned with `src/app/model/*` types
2. Treat `openapi.yaml` as the only contract authority
3. Mock socket traffic in Playwright tests via `SocketIOMock`
4. Avoid brittle timing; use explicit waits on URL/state/locator expectations