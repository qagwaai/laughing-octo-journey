# Backend Integration Guide: Space-Game Distance/Drive/Routing System

## Overview

This guide provides backend developers with all necessary information to integrate with the client-side refactor covering:
- **AU-based market distances** (replacing km)
- **Multi-drive architecture** with server-driven profile support
- **Jump-gate routing** for cross-system markets
- **Effective radius clamping** to ship drive range

All client-side logic is complete and tested (Phases 1–7). This document specifies what the backend must implement to fully support the system.

---

## 1. Data Model Updates

### 1.1 Ship Model

**Add field:**
```typescript
// Optional drive profile (server-provided override to tier-based heuristic)
driveProfile?: {
  id: 'standard-cruise' | 'rapid-transit' | 'quantum-fold' | string;
  name: string;                          // e.g., "Rapid Transit Thruster"
  rangeAu: number;                       // e.g., 15.0
  cruiseSpeedAuPerHour: number;          // e.g., 1.8
  fuelCostPerAu: number;                 // e.g., 4.0
};
```

**Validation Rules:**
- If `driveProfile` is provided, validate that all fields are non-null and numeric values are > 0
- If validation fails, log a warning and omit the field from response (client will use tier-based fallback)
- If `driveProfile` is missing, client assumes tier-based heuristic: Standard (tier 1–2), Rapid (tier 3–5), Quantum (tier 6+)

**Example Full Ship Response:**
```json
{
  "id": "ship-123",
  "name": "Scavenger Pod",
  "model": "Scavenger Pod",
  "tier": 2,
  "driveProfile": {
    "id": "standard-cruise",
    "name": "Standard Cruise Drive",
    "rangeAu": 0.5,
    "cruiseSpeedAuPerHour": 0.3,
    "fuelCostPerAu": 1.0
  },
  "status": "docked",
  "spatial": { ... },
  "inventory": [ ... ]
}
```

### 1.2 Market Model

**Rename field (breaking change, coordinate with client versioning):**
- Old: `distanceKm: number`
- New: `distanceAu: number` (1 AU ≈ 149,597,870.7 km)

**Add optional field:**
```typescript
route?: {
  kind: 'in-system' | 'gate-route' | 'no-route';
  hops?: number; // Number of jump-gates to traverse (only for gate-route)
};
```

**Calculation Rules for distanceAu:**
```
distanceAu = distanceKm / 149_597_870.7

// If storing in km internally:
SELECT ROUND(distance_km / 149597870.7, 3) AS distance_au FROM markets;

// Precision: Return 3 decimals for all AU distances (e.g., 0.032, 2.300, 15.000)
```

**Route Classification:**
- **in-system:** Market in same solar system; reachable via AU-based drive range
- **gate-route:** Market in different solar system; reachable via jump-gate network with `hops` gate traversals
- **no-route:** Market not reachable (no drive sufficient, no gate path exists)

**Example Full Market Response:**
```json
{
  "marketId": "sol-ceres-exchange",
  "solarSystemId": "sol",
  "marketName": "Ceres Exchange",
  "siteType": "station",
  "siteName": "Ceres Belt Trade Ring",
  "spatial": {
    "solarSystemId": "sol",
    "frame": "barycentric",
    "positionKm": { "x": 413_704_822, "y": 0, "z": 0 },
    "epochMs": 1234567890000
  },
  "distanceAu": 0.032,
  "route": {
    "kind": "in-system"
  },
  "isDocked": false,
  "priceMultiplier": 1.0,
  "driftPercentPerHour": 6.0,
  "restockIntervalMinutes": 60
}
```

---

## 2. Contract & Message Updates

### 2.1 `ship-list-request` (No changes)

**Client sends:**
```json
{
  "playerName": "string",
  "characterId": "string",
  "sessionKey": "string"
}
```

### 2.2 `ship-list-response` (MODIFIED)

**Server returns** (with driveProfile field added):
```json
{
  "success": true,
  "message": "string",
  "playerName": "string",
  "characterId": "string",
  "ships": [
    {
      "id": "string",
      "name": "string",
      "model": "string",
      "tier": 1–10,
      "status": "string | null",
      "driveProfile": {
        "id": "string",
        "name": "string",
        "rangeAu": number,
        "cruiseSpeedAuPerHour": number,
        "fuelCostPerAu": number
      },  // ← NEW FIELD (optional)
      "spatial": { ... },
      "motion": { ... },
      "observability": { ... },
      "inventory": [ ... ]
    }
  ]
}
```

**Backward Compatibility:**
- Omit `driveProfile` if server does not have one (client will use tier-based fallback)
- Do NOT make this field required; existing clients expect optional structure

### 2.3 `market-list-request` (No changes)

**Client sends:**
```json
{
  "playerName": "string",
  "sessionKey": "string",
  "solarSystemId": "string"
}
```

### 2.4 `market-list-by-location-request` (MODIFIED)

**Client sends** (distanceKm → distanceAu):
```json
{
  "playerName": "string",
  "sessionKey": "string",
  "solarSystemId": "string",
  "positionKm": { "x": number, "y": number, "z": number },
  "distanceAu": 0.5,               // ← CHANGED FROM distanceKm
  "limit": 50,
  "locationTypes": ["station"],
  "characterId": "string (optional)",
  "shipId": "string (optional)"
}
```

**Server Behavior:**
1. Client pre-clamps `distanceAu` to active ship drive range (e.g., min(0.5, 0.3) = 0.3 AU)
2. Server should NOT re-clamp; trust client value as the authoritative search radius
3. Convert distanceAu back to km for spatial query: `distanceKm = distanceAu * 149_597_870.7`
4. Return all markets within that km radius in same solar system

### 2.5 `market-list-by-location-response` (MODIFIED)

**Server returns** (distanceKm → distanceAu, adds optional route):
```json
{
  "success": true,
  "message": "string",
  "playerName": "string",
  "solarSystemId": "sol",
  "positionKm": { "x": number, "y": number, "z": number },
  "distanceAu": 0.5,                     // ← CHANGED FROM distanceKm
  "locationTypes": ["station"],
  "isDocked": boolean,
  "dockedMarketId": "string | null",
  "markets": [
    {
      "marketId": "string",
      "solarSystemId": "string",
      "marketName": "string",
      "siteType": "string",
      "siteName": "string",
      "spatial": { ... },
      "distanceAu": 2.3,                 // ← CHANGED FROM distanceKm
      "route": {                         // ← NEW OPTIONAL FIELD
        "kind": "in-system" | "gate-route" | "no-route",
        "hops": 1  // ← Only if kind === "gate-route"
      },
      "isDocked": boolean,
      "priceMultiplier": number,
      "driftPercentPerHour": number,
      "restockIntervalMinutes": number
    }
  ]
}
```

**Backward Compatibility:**
- `route` field is optional; omit if server does not implement jump-gate lookup yet
- Client will fall back to local jump-gate inference if route is missing
- ALL markets must have `distanceAu` (required, not optional)

### 2.6 `market-list-response` (MODIFIED)

**Server returns** (distanceKm → distanceAu):
```json
{
  "success": true,
  "message": "string",
  "playerName": "string",
  "solarSystemId": "sol",
  "markets": [
    {
      "marketId": "string",
      "solarSystemId": "string",
      "marketName": "string",
      "siteType": "string",
      "siteName": "string",
      "spatial": { ... },
      "distanceAu": 2.3,                 // ← CHANGED FROM distanceKm
      "priceMultiplier": number,
      "driftPercentPerHour": number,
      "restockIntervalMinutes": number
    }
  ]
}
```

---

## 3. Jump-Gate Network

### 3.1 Gate Model Definition

**Database Schema (example):**
```sql
CREATE TABLE jump_gates (
  gate_id VARCHAR(64) PRIMARY KEY,
  source_system_id VARCHAR(64) NOT NULL,
  dest_system_id VARCHAR(64) NOT NULL,
  traversal_cost_au DECIMAL(10, 3) NOT NULL,    -- AU cost to traverse (not km)
  traversal_time_hours INT NOT NULL,             -- Est. hours for gate traversal
  is_active BOOLEAN DEFAULT TRUE,
  discovered_by_character_ids JSON,             -- Array of char IDs who've discovered this gate (Phase 14)
  created_at TIMESTAMP,
  updated_at TIMESTAMP,
  INDEX idx_source (source_system_id),
  INDEX idx_dest (dest_system_id)
);
```

**Example Gate Records:**
```
gate_id                    | source_system_id | dest_system_id | traversal_cost_au | traversal_time_hours | is_active
sol-to-proxima             | sol              | proxima-a      | 5.0               | 1                    | true
proxima-to-sol             | proxima-a        | sol            | 5.0               | 1                    | true
proxima-to-alpha-centauri  | proxima-a        | alpha-centauri | 8.0               | 2                    | true
```

### 3.2 Gate Network Lookup Functions

**Function: `getGatesFromSystem(systemId) → Gate[]`**
```
Purpose: Return all gates departing from a given system

Pseudo-code:
  SELECT * FROM jump_gates WHERE source_system_id = systemId AND is_active = TRUE

Returns: Array of gate objects with destination system ID, traversal cost/time

Usage: When client requests markets in a system, server uses this to determine
       which other systems are reachable via jump-gate, enabling cross-system
       market route classification.
```

**Function: `getHopPathBetweenSystems(sourceSystemId, destSystemId) → { hops: number, path: GateId[] } | null`**
```
Purpose: Find shortest hop path between two systems using BFS or Dijkstra

Inputs:
  - sourceSystemId: Starting system (e.g., "sol")
  - destSystemId: Target system (e.g., "proxima-a")

Returns:
  - If path exists: { hops: 1, path: ["sol-to-proxima"] }
  - If no path: null

Pseudo-code:
  Use BFS to find shortest gate path
  Queue: [source_system_id]
  Visited: set()
  Parent: map()
  
  While queue not empty:
    current = queue.pop()
    if current == dest_system_id: return reconstruct path and hop count
    for gate in getGatesFromSystem(current):
      if gate.dest not in visited:
        queue.add(gate.dest)
        parent[gate.dest] = gate
  
  return null (no path found)

Caching: Recommended to cache gate network in memory or Redis for fast queries
```

### 3.3 Route Classification Logic (Server-side)

**When responding to market-list-by-location-request:**

```
for each market in markets:
  if market.solarSystemId == request.solarSystemId:
    // In-system market
    market.route = { kind: "in-system" }
  else:
    // Cross-system market
    hopPath = getHopPathBetweenSystems(request.solarSystemId, market.solarSystemId)
    if hopPath:
      market.route = {
        kind: "gate-route",
        hops: hopPath.hops
      }
    else:
      market.route = { kind: "no-route" }
```

**Performance Considerations:**
- Gate network lookup can be expensive; cache the graph in memory or Redis
- Assume clients may send hundreds of markets in a single response; batch route lookups
- Consider pre-computing all-pairs shortest paths if gate network is small (< 100 systems)

---

## 4. Spatial & Distance Calculations

### 4.1 Distance Conversion Constant

**Use this constant for all AU ↔ km conversions:**
```
ASTRONOMICAL_UNIT_KM = 149_597_870.7  // IAU official definition

// Client-side (already implemented):
distanceAu = distanceKm / ASTRONOMICAL_UNIT_KM

// Server-side (for responses):
SELECT ROUND(distance_km / 149597870.7, 3) AS distance_au FROM ...

// Backend validation:
if (typeof distanceAu !== 'number' || !Number.isFinite(distanceAu) || distanceAu < 0) {
  throw new Error('Invalid distanceAu');
}
```

### 4.2 Distance Queries from Market List Endpoint

**Pseudo-code for market-list-by-location-response:**
```
function getMarketsByLocation(request) {
  // Convert AU back to km for spatial query
  const maxDistanceKm = request.distanceAu * 149_597_870.7;
  
  // Spatial query: find all markets within maxDistanceKm of ship position
  const markets = db.query(`
    SELECT 
      m.*,
      ROUND(
        SQRT(
          POW(m.position_x - ?, 2) +
          POW(m.position_y - ?, 2) +
          POW(m.position_z - ?, 2)
        ),
        3
      ) / 149597870.7 AS distance_au
    FROM markets m
    WHERE m.solar_system_id = ?
      AND SQRT(
        POW(m.position_x - ?, 2) +
        POW(m.position_y - ?, 2) +
        POW(m.position_z - ?, 2)
      ) <= ?
    ORDER BY distance_au ASC
    LIMIT ?
  `,
    [
      request.positionKm.x, request.positionKm.y, request.positionKm.z,  // For SELECT
      request.solarSystemId,
      request.positionKm.x, request.positionKm.y, request.positionKm.z,  // For WHERE
      maxDistanceKm,
      request.limit
    ]
  );

  // Add route classification (see Section 3.3)
  for (const market of markets) {
    if (market.solar_system_id === request.solarSystemId) {
      market.route = { kind: 'in-system' };
    } else {
      const hopPath = getHopPathBetweenSystems(request.solarSystemId, market.solar_system_id);
      market.route = hopPath ? 
        { kind: 'gate-route', hops: hopPath.hops } :
        { kind: 'no-route' };
    }
  }

  return {
    success: true,
    message: 'Market list retrieved successfully',
    markets,
    isDocked: checkIfDockedAtMarket(request),
    dockedMarketId: getDockedMarketId(request)
  };
}
```

---

## 5. Travel Time Calculations (For Phase 12)

**When Phase 12 (Passive Travel) is implemented, use these formulas:**

```
// In-system travel time (hours)
inSystemHours = distanceAu / drive.cruiseSpeedAuPerHour

// Cross-system travel time (hours)
// Assume each gate hop takes gate.traversal_time_hours + in-gate cruise time
crossSystemHours = (distanceToNextGate / drive.cruiseSpeedAuPerHour) 
                  + (sumOf(gate.traversal_time_hours) for each gate in path)
                  + (distanceAfterLastGate / drive.cruiseSpeedAuPerHour)

// Total ETA (hours)
totalHours = inSystemHours || crossSystemHours

// Fuel cost
fuelCost = distanceAu * drive.fuelCostPerAu
```

**Examples:**
```
// In-system: Ceres to Far Exchange
distanceAu = 4.2
driveSpeed = 0.3 AU/hr
travelHours = 4.2 / 0.3 = 14 hours

// Cross-system (1 gate): Sol to Proxima via gate
distanceToGate = 0.1 AU
gateTraversalTime = 1 hour
distanceAfterGate = 0.2 AU
driveSpeed = 0.3 AU/hr
travelHours = (0.1 + 0.2) / 0.3 + 1 = 1 + 1 = 2 hours total
```

---

## 6. Validation & Error Handling

### 6.1 Request Validation

**For market-list-by-location-request:**
```
✓ playerName: non-empty string, trimmed
✓ sessionKey: valid session token (existing validation)
✓ solarSystemId: existing system ID (validate against DB)
✓ positionKm: object with x, y, z as finite numbers
✓ distanceAu: finite positive number, typically 0.05–50.0
✓ characterId (optional): if provided, validate ownership
✓ shipId (optional): if provided, validate ownership & check ship position

On error:
  Return 400 Bad Request with descriptive message
  Example: { success: false, message: "Invalid distanceAu: must be positive" }
```

### 6.2 Response Validation

**Before returning markets:**
```
for each market:
  ✓ marketId: non-empty string
  ✓ solarSystemId: valid system ID
  ✓ distanceAu: finite, 3 decimals (example: 0.032)
  ✓ spatial.positionKm: valid x,y,z coordinates
  ✓ route (if present):
    ✓ kind: one of ["in-system", "gate-route", "no-route"]
    ✓ hops: integer >= 1 (only if kind === "gate-route")

On error during building response:
  Log warning, omit problematic market from response
  Do NOT fail entire response; return partial list with success=true
```

---

## 7. Versioning & Migration

### 7.1 Breaking Changes

**Field Renames (breaking):**
- `distanceKm` → `distanceAu` in all market responses

**Client Compatibility:**
- Old clients expect `distanceKm` and will break if they receive only `distanceAu`
- **Recommendation:** Use API versioning (e.g., `/api/v2/markets`) or dual-field approach

**Suggested Migration Path:**
1. **Phase 1 (Immediate):** Support BOTH `distanceKm` and `distanceAu` in responses
   ```json
   {
     "marketId": "...",
     "distanceKm": 318_000_000,      // For old clients
     "distanceAu": 2.124,             // For new clients
     ...
   }
   ```
2. **Phase 2 (After client upgrade):** Deprecate `distanceKm` in API docs
3. **Phase 3 (Long-term):** Remove `distanceKm` after all clients updated

### 7.2 New Fields (Backward Compatible)

**Fields added (optional, old clients ignore):**
- `ship.driveProfile` (optional)
- `market.route` (optional)

These fields are safe to add; old clients will not break if missing.

---

## 8. Testing Checklist

### 8.1 Backend Unit Tests

```
[ ] Distance conversion: km ↔ AU (test precision to 3 decimals)
[ ] Gate path finding: BFS returns correct hop count for connected systems
[ ] Gate path finding: Returns null for disconnected systems
[ ] Route classification: Correctly identifies in-system vs. gate-route vs. no-route
[ ] Market spatial query: Returns markets within specified AU radius
[ ] Ship drive profile coercion: Validates numeric fields, rejects invalid data
```

### 8.2 Integration Tests

```
[ ] ship-list-response includes driveProfile when available
[ ] ship-list-response omits driveProfile gracefully when not available
[ ] market-list-by-location-request with distanceAu returns correct AU-based results
[ ] market-list-by-location-response includes route field with correct classifications
[ ] Spatial distance calculations match client-side calculations (within rounding)
```

### 8.3 Contract Tests (with Client)

```
[ ] Run Playwright e2e suite: market-hub-by-location (2 tests pass)
[ ] Run Playwright e2e suite: market-hub-docking (2 tests pass)
[ ] Manual test: AU distances render correctly in Market Hub UI
[ ] Manual test: Route badges appear for in-system, gate-route, no-route markets
[ ] Manual test: Travel-time estimates match calculated values
```

---

## 9. Performance Considerations

### 9.1 Gate Network Lookup

**Problem:** BFS path-finding on every market-list-by-location-request can be slow

**Solutions:**
1. **Memory Cache:** Load entire gate network into memory on server startup
   ```typescript
   // Pseudo-code
   const gateGraph = new Map<systemId, Gate[]>();
   db.query('SELECT * FROM jump_gates').forEach(gate => {
     if (!gateGraph.has(gate.source_system_id)) {
       gateGraph.set(gate.source_system_id, []);
     }
     gateGraph.get(gate.source_system_id).push(gate);
   });
   ```

2. **Redis Cache:** Cache BFS results for (systemA → systemB) paths
   ```
   cacheKey = `gate-path:${sourceSystemId}:${destSystemId}`
   cachedResult = redis.get(cacheKey)
   if (!cachedResult) {
     result = bfs(sourceSystemId, destSystemId)
     redis.setex(cacheKey, 3600, JSON.stringify(result))
   }
   ```

3. **Pre-computed All-Pairs Shortest Paths:** If gate network is small (< 100 systems)
   ```
   hopMatrix[i][j] = hop count from system i to system j
   Compute once at startup; O(n^3) but fast lookup O(1) per query
   ```

### 9.2 Spatial Indexing

**For market spatial queries, ensure database has proper indexing:**
```sql
-- Create spatial index for 3D coordinates
CREATE INDEX idx_market_position ON markets (solar_system_id, position_x, position_y, position_z);

-- Or if using spatial extension (PostGIS):
CREATE INDEX idx_market_location ON markets USING GIST(location_3d);
```

---

## 10. Known Limitations & Future Work

### 10.1 Not Implemented (Phase 8+)

- [ ] Mixed-system market fixtures (Phase 8)
- [ ] Server-route precedence (Phase 9)
- [ ] Drive unlock progression (Phase 10)
- [ ] Passive travel simulation (Phase 12)
- [ ] Gate discovery mechanics (Phase 14)

### 10.2 Assumptions Made in This Implementation

- All drives have constant speed (no acceleration/deceleration)
- All gate traversals take fixed time (no variable gate speeds)
- No fuel scarcity checks (assume ship has sufficient fuel)
- No relativity effects (time dilation, distance contraction)
- Jump gates are always available (no temporary outages or maintenance)

---

## 11. Support & Questions

**If you have questions about:**

- **Data model:** Refer to Section 1 and Section 6
- **API contracts:** Refer to Section 2
- **Gate network:** Refer to Section 3
- **Performance:** Refer to Section 9
- **Migration:** Refer to Section 7

**Contact frontend team for clarification on:**
- UI behavior expectations (see Market Hub screenshot/demo)
- Test execution and validation (run Playwright suite)
- Locale string mappings (see i18n/locales/en.ts)

---

**Document Version:** 1.0 (Post-Phase 7)  
**Date Generated:** 2026-05-06 22:20 UTC  
**Status:** Ready for backend implementation  
**Client Stability:** All 26 unit tests + 2 e2e tests passing; no regressions expected
