# Models & API Contracts

## Overview

TypeScript interfaces and types in `src/app/model/` define the shape of all data exchanged with the backend via Socket.IO. The authoritative contract source is the backend OpenAPI specification at `http://localhost:3000/openapi.yaml`.

## Contract Safety Rules (from AGENTS.md)

1. `openapi.yaml` is the only contract authority
2. Model types must align with OpenAPI
3. Do NOT use alternate contract docs when OpenAPI is available
4. If OpenAPI is missing required messaging detail, report it instead of guessing
5. When changing socket contracts, validate both type-level correctness and behavior-level correctness

## Key Model Modules

### Character Models (`model/character-list.ts`)

```typescript
interface PlayerCharacterSummary {
  id: string;
  name: string;
  // ... character metadata
}
```

Used for character selection, session state, and navigation context.

### Ship Models (`model/ship.ts`, `model/ship-exterior-*.ts`)

- `Ship` - Full ship representation with hull, systems, inventory
- `ShipExteriorViewMissionContext` - Mission-scoped ship state for the exterior scene
- `ShipExteriorViewSeedPolicy` - Asteroid seeding configuration per mission
- `ShipExteriorViewCheckpoint` - Position/rotation checkpoints for flight sync

### Mission Models (`model/mission*.ts`)

- `MissionGateStep` - Individual progression gates within a mission
- `MissionContext` - Runtime mission state including seed policy, damage presets
- `FIRST_TARGET_MISSION_ID` - Constant for the entry mission identifier

### Market Models (`model/market-hub*.ts`)

- `MarketListing` - A buy/sell listing with price, quantity, item references
- `MarketListRequest` / `MarketListResponse` - Socket event payloads
- Currency types and pricing metadata

### Asteroid & Scan Models

- `AsteroidScanSample` - Scan results with material profile, PBR params, SW13B metadata
- `AsteroidRenderTier` - Enum: `hero`, `standard`, `background`
- `ExternalObjectDescriptor` - 3D rendering configuration for objects

### Item & Catalog Models (`model/catalog/`)

- Item definitions with catalog IDs
- Craftable items configuration
- Mission catalog definitions

## Socket Event Payload Pattern

All socket events follow a request/response pattern with correlation IDs:

```typescript
// Request
interface SomeRequest {
  correlationId: string;
  // ... domain-specific fields
}

// Response
interface SomeResponse {
  correlationId: string;
  success: boolean;
  data?: SomePayload;
  error?: string;
}
```

## Type Safety Guidance

- Model types are imported directly, not re-declared inline
- Socket services use generic `emit<T>` with explicit type parameters
- Response handlers validate payload shape before processing
- Dev-mode contract violation tracking catches mismatches at runtime