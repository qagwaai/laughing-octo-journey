```text
Forge, implement the SW-15 contract change for three new character bust descriptor fields: facialHair, scar, and tattoo.

Context and source documents:
- c:/Development/Projects/Github/laughing-octo-journey/docs/planning/sw-15/sw-15-m2a1-character-preview-2d-design.md
- c:/Development/Projects/Github/laughing-octo-journey/src/app/model/bust-descriptor.ts
- c:/Development/Projects/Github/laughing-octo-journey/docs/planning/sw-15/sw-15-m0v-verification-note.md

Important constraints:
- OpenAPI is the source of truth. Do not paper over drift in Nova with fallback logic.
- The three new fields must be added at the contract source, then propagated through backend validation, persistence, and emitted read/write payloads.
- We do not have every backend detail in this handoff; use best judgment for the exact Forge implementation path, but keep behavior aligned with the existing bust descriptor flow.
- Treat these fields as required string properties on the normalized bust descriptor and on character/NPC create-update write payloads wherever the existing descriptor fields are required today.
- If Forge exposes optional NPC override fields for per-field deterministic-seed overrides, extend that override shape with optional facialHair, scar, and tattoo entries using the same existing override semantics.
- Persist the new fields in the database. Runtime-only or contract-only changes are not acceptable.
- If this requires a schema or contract version bump, make the minimal coherent versioning change and update any fixtures/tests accordingly.

New domains to add:
- facialHair: none, stubble, short-beard, full-beard, goatee
- scar: none, cheek-left, cheek-right, brow-left, brow-right, chin
- tattoo: none, temple-left, temple-right, neck-left, neck-right

Expected implementation scope:
1. Update the Forge OpenAPI contract authority for BustDescriptor and any related request/response components so facialHair, scar, and tattoo are present anywhere the descriptor is defined or returned.
2. Update backend validation/schema layers so these properties are accepted only for the allowed values above and rejected consistently with the existing hard-reject validation behavior.
3. Update persistence and read/write mapping so create, update, and read round-trip the three fields without loss.
4. Update any canonical fixtures, contract snapshots, generated schema artifacts, or tests that assert the descriptor shape.
5. Keep existing contract behavior unchanged apart from the addition of these fields.

Acceptance criteria:
1. Forge OpenAPI now includes facialHair, scar, and tattoo on the bust descriptor contract surfaces used by Nova.
2. Character bust create/update requests can store the new fields and subsequent reads return the same values.
3. NPC bust flows also support the new fields consistently with the existing descriptor/override model.
4. Invalid values for any of the three fields are hard-rejected through the established validation path.
5. Database persistence is verified, not just in-memory handling.
6. Any generated or checked-in schema artifacts remain in sync with OpenAPI.

Deliverables back to Nova/Orion:
- The exact OpenAPI/schema files changed.
- The persistence/storage surface changed.
- The tests added or updated.
- Any schemaVersion or presetVersion decision taken, with rationale.
- Confirmation of the runtime contract verification method used.

If the current Forge OpenAPI file path differs from this repo’s assumptions, update the real contract authority in Forge and report the actual path in your handoff.
```