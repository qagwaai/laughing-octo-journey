# Server Message Contracts

This document describes the socket message contracts currently used by the application when talking to the server.

## Scope

- Source of truth: client-side models and usage in page components.
- These contracts are what the client expects to send and receive.
- If server behavior differs, update both server and this document together.

## Global Requirements

- Transport: Socket.IO events.
- Message shape: JSON-compatible payloads.
- Session handling: authenticated character operations require a valid `sessionKey`.
- Invalid session behavior: server can emit `invalid-session` at any time; client clears session and routes back to login.
- One-response pattern: for each request event below, the client attaches one temporary response listener and unsubscribes after the first matching response.

## Event Catalog

| Event Name | Direction | Purpose |
| --- | --- | --- |
| `login` | client -> server | Authenticate existing player |
| `login-response` | server -> client | Return login result |
| `register` | client -> server | Register a new player |
| `register-response` | server -> client | Return registration result |
| `character-list-request` | client -> server | Fetch player characters |
| `character-list-response` | server -> client | Return character list |
| `character-add-request` | client -> server | Create a new character |
| `character-add-response` | server -> client | Return character creation result |
| `character-edit` | client -> server | Update an existing character |
| `character-edit-response` | server -> client | Return character edit result |
| `character-delete-request` | client -> server | Delete an existing character |
| `character-delete-response` | server -> client | Return character delete result |
| `invalid-session` | server -> client | Notify client session is no longer valid |

---

## Login

### `login` (request)

Required payload:

```json
{
  "playerName": "string",
  "password": "string"
}
```

Client-side field constraints:

- `playerName`: required, length 3..20.
- `password`: required, minimum length 8.

Server requirements:

- Validate presence and type for both fields.
- Authenticate against stored player credentials.
- Return `login-response` for every `login` request.

### `login-response` (response)

Payload:

```json
{
  "success": true,
  "message": "string",
  "reason": "PLAYER_NOT_REGISTERED | PASSWORD_MISMATCH | UNKNOWN (optional)",
  "playerId": "string (optional)",
  "sessionKey": "string (optional)"
}
```

Edge cases:

- If `success` is `true` and `sessionKey` is omitted, login still appears successful in UI but later authenticated operations can fail. Prefer always returning `sessionKey` on success.
- For failures, use stable `reason` values so UI branches correctly:
  - `PLAYER_NOT_REGISTERED`: UI suggests registration.
  - `PASSWORD_MISMATCH`: UI does not suggest registration.

---

## Registration

### `register` (request)

Required payload:

```json
{
  "playerName": "string",
  "email": "string",
  "password": "string"
}
```

Client-side field constraints:

- `playerName`: required, length 3..20.
- `email`: required, must pass email validator.
- `password`: required, minimum length 8.
- Client confirms password separately before emitting `register`.

Server requirements:

- Validate field presence/types and reject malformed input.
- Enforce uniqueness constraints (player name and/or email).
- Return `register-response` for every `register` request.

### `register-response` (response)

Payload:

```json
{
  "success": true,
  "message": "string",
  "playerId": "string (optional)",
  "sessionKey": "string (optional)"
}
```

Edge cases:

- If `success` is `true` without `sessionKey`, immediate navigation succeeds but next authenticated request may fail. Prefer returning `sessionKey` on success.
- On failure, return clear `message` values because UI displays message directly.

---

## Character Listing

### `character-list-request` (request)

Required payload:

```json
{
  "playerName": "string",
  "sessionKey": "string"
}
```

Client-side behavior:

- `playerName` is trimmed before sending.
- If trimmed `playerName` is empty, request is not sent.

Server requirements:

- Validate `sessionKey` and player ownership.
- Return `character-list-response`.
- If session is invalid/expired, emit `invalid-session`.

### `character-list-response` (response)

Payload:

```json
{
  "success": true,
  "message": "string",
  "playerName": "string",
  "characters": [
    {
      "id": "string",
      "characterName": "string",
      "level": "number (optional)",
      "createdAt": "string (optional)"
    }
  ]
}
```

Edge cases:

- `characters` should always be an array; client falls back to `[]` if undefined.
- Keep `id` stable and unique; it is used for edit/delete targeting.
- If `success` is `false`, include a user-safe `message`.

---

## Character Create

### `character-add-request` (request)

Required payload:

```json
{
  "playerName": "string",
  "characterName": "string",
  "sessionKey": "string"
}
```

Client-side field constraints:

- `characterName`: required, length 2..24.
- `playerName` must be non-empty after trim.

Server requirements:

- Validate `sessionKey` and ownership.
- Validate character name policy (length, charset, uniqueness rules).
- Return `character-add-response`.

### `character-add-response` (response)

Payload:

```json
{
  "success": true,
  "message": "string",
  "playerName": "string",
  "characterName": "string (optional)",
  "characterId": "string (optional)"
}
```

Edge cases:

- On success, include `characterId` when possible to support future client-side optimistic updates.
- On failure, include actionable `message` (for example duplicate name).

---

## Character Edit

### `character-edit` (request)

Required payload:

```json
{
  "characterId": "string",
  "playerName": "string",
  "characterName": "string",
  "sessionKey": "string"
}
```

Client-side requirements:

- Sent only when setup page is in edit mode.
- Client refuses to emit if `characterId` is missing.
- Same character name validation as create mode.

Server requirements:

- Verify `characterId` exists and belongs to `playerName` in current session.
- Apply rename/update semantics for the existing character record.
- Return `character-edit-response`.

### `character-edit-response` (response)

Payload:

```json
{
  "success": true,
  "message": "string",
  "playerName": "string",
  "characterId": "string",
  "characterName": "string (optional)"
}
```

Edge cases:

- If `characterId` is not found or does not belong to the player, return `success: false` with explicit message.
- If name conflicts with another character, return `success: false` and message indicating conflict.

---

## Character Delete

### `character-delete-request` (request)

Required payload:

```json
{
  "playerName": "string",
  "characterId": "string",
  "characterName": "string (optional)",
  "sessionKey": "string"
}
```

Client-side behavior:

- Request is sent only after explicit user confirmation.
- `characterName` is included as optional metadata.

Server requirements:

- Validate session and ownership.
- Delete by `characterId` (do not rely on `characterName`).
- Return `character-delete-response`.

### `character-delete-response` (response)

Payload:

```json
{
  "success": true,
  "message": "string",
  "playerName": "string",
  "characterId": "string (optional)"
}
```

Edge cases:

- If already deleted, choose deterministic behavior:
  - Either idempotent success with message, or
  - failure with explicit not-found message.
- Returning `characterId` helps client reconciliation in multi-tab scenarios.

---

## Invalid Session

### `invalid-session` (server event)

Payload:

```json
{
  "message": "string"
}
```

Client behavior:

- Clears local session key.
- Navigates to login view.

Server recommendations:

- Emit when session key is missing, expired, revoked, malformed, or mismatched to player context.
- Keep `message` safe for end users (avoid leaking internals).

---

## Cross-Cutting Edge Cases

- Out-of-order responses:
  - Client assumes one in-flight request per message type in a page.
  - If server can reply out of order under concurrency, consider adding a `requestId` field in future versions.
- Missing response:
  - Current client has no timeout/retry per request. Silent server drops will leave UI in submitting/loading state.
  - Recommended improvement: server always acknowledges requests; client can add timeout handling later.
- Payload normalization:
  - Some requests trim values client-side (`playerName` in character pages), some do not (`login`, `register`).
  - Server should normalize and validate consistently.
- Error messages:
  - Several pages display server `message` directly.
  - Keep messages user-readable and non-sensitive.
