# Forge Escalation: Mission List Correlation Contract Drift (2026-05-25)

## Summary
Frontend mission-list consumers now require strict correlation matching.
Responses that omit either correlationId or requestIdentity are dropped intentionally.

Current drift:
- Contract docs still describe a rollout fallback path.
- Frontend type models still mark correlation fields as optional.
- Frontend runtime and tests enforce strict matching in mission wrappers.

## Evidence in Repository

### Legacy contract docs (now removed)
- The previous mismatch included rollout fallback language in a legacy contract doc.
- That file has been removed to keep OpenAPI as the single contract authority.

### Mission-list model still marks fields optional
- [src/app/model/mission-list.ts](src/app/model/mission-list.ts#L21)
  - requestIdentity is optional on request.
- [src/app/model/mission-list.ts](src/app/model/mission-list.ts#L30)
  - correlationId and requestIdentity are optional on response.

### Frontend wrappers now enforce strict matching
- [src/app/services/mission.service.ts](src/app/services/mission.service.ts#L45)
  - Rejects response if correlationId missing or mismatched.
  - Rejects response if requestIdentity missing.
- [src/app/services/mission-board.service.ts](src/app/services/mission-board.service.ts#L28)
  - Same strict behavior in mission-board wrapper.

### Integration test verifies strict behavior
- [src/app/services/mission-list-correlation.integration.spec.ts](src/app/services/mission-list-correlation.integration.spec.ts#L161)
  - Legacy responses without correlation metadata are expected to be dropped.

## Runtime Impact
Manual QA can see warnings that mission-list responses are dropped even when player and character appear correct, if requestIdentity is missing.

This can block downstream gameplay state refresh that depends on mission-list delivery.

## Request to Forge
Please update list-missions-response generation so every response always echoes:
- correlationId: exact value from list-missions-request
- requestIdentity: exact object from list-missions-request

Apply this on all response paths:
- success
- empty list success
- validation or business error responses where a response is still emitted

## Acceptance Criteria
1. For every list-missions-request, emitted list-missions-response includes non-empty correlationId.
2. list-missions-response.requestIdentity deep-equals request.requestIdentity.
3. No list-missions-response path omits requestIdentity.
4. Manual flow no longer produces mission-list dropped warnings due to missing requestIdentity.

## Suggested Contract Follow-Up (after Forge confirms)
- Update mission-list request and response shapes in frontend model to required fields.
- Remove rollout fallback language from server-message-contracts docs.
