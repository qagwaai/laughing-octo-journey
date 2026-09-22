# Security decision review - 2026-09-21

## Temporary decision: persist the selected ship in session storage

**Status: accepted short-term workaround; security and architecture review required.**

Browser refresh recreated `SessionService` with no active ship, even though the
authenticated session and character were restored. Scene bootstrap fetched ships
but did not restore the application-wide selected ship.

For now, store the selected `ShipSummary` in browser `sessionStorage` under
`stellar.activeShip` and restore it when the service is created. This snapshot
includes ship data such as inventory and spatial state, not just its ID. Persist
resolved ship updates and explicit spatial updates; remove the snapshot when the
active ship or the session is cleared. Storage errors are logged and malformed
snapshots are discarded.

This is an explicitly temporary expansion of browser-held state, not the desired
long-term security direction.

## Risks and limitations

- Same-origin JavaScript can read and modify session storage. XSS or compromised
  scripts can expose or tamper with the snapshot; session storage is not a secure
  vault.
- Restored ship data is an untrusted UI cache, not proof of ownership or permission.
  The backend must independently authorize every ship operation.
- Cached inventory, ownership, and position may be stale. The existing same-ship
  spatial stickiness rule also applies after restoration; server reconciliation
  needs explicit review.
- The existing authentication session key is already stored in session storage.
  That credential warrants a separate authentication review; this workaround does
  not change or improve its protection.
- Clearing storage can fail when browser storage is unavailable; such failures are
  logged. This mechanism is not a substitute for server-side session invalidation.

## Required follow-up

- Revisit whether the selected ship should be maintained server-side and restored
  from an authenticated, authorized bootstrap response.
- Prefer authoritative ship hydration over persisting full ship snapshots; if a
  browser preference remains necessary, assess storing only a scoped ship ID.
- Review logout, session expiry, account/character switching, deleted or transferred
  ships, and stale-cache reconciliation.
- Review moving authentication credentials to Secure, HttpOnly cookies with
  appropriate SameSite, CSRF, and socket origin protections, subject to backend
  support.

This document records a decision and follow-up work, not a completed security audit.
