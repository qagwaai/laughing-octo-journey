# SW-15 M2A1 — 2D Character Preview Design

**Date:** 2026-06-06
**Status:** Proposal — awaiting PoC asset generation
**Author:** Nova (frontend) / Orion (coordination)
**Predecessor:** SW-15 M2-A (3D bust viewer — being replaced)

---

## Decision

Replace the 3D procedural bust viewer with a 2D asset-based character preview. The 3D approach is being retired because photorealistic human faces cannot be achieved procedurally at the quality level required by the project north star. The 2D approach enables full artistic control via AI-generated or commissioned JPEG assets.

---

## Full Characteristic Set

The following characteristics are the **active full set** for the character descriptor and filename scheme.

| Field | Type | Current Values | Cardinality |
|---|---|---|---|
| `faceShape` | `BustFaceShape` | oval, round, square, angular, narrow | 5 |
| `skinTone` | `BustSkinTone` | pale, light, medium, tan, dark, deep | 6 |
| `hairStyle` | `BustHairStyle` | short-crop, mid-fade, long-loose, braided, shaved, slicked | 6 |
| `hairColor` | `BustHairColor` | black, brown, auburn, blonde, silver, white, red | 7 |
| `eyeStyle` | `BustEyeStyle` | narrow, wide, almond, hooded, round | 5 |
| `eyeColor` | `BustEyeColor` | brown, hazel, green, blue, grey, amber, violet | 7 |
| `expressionPreset` | `BustExpressionPreset` | neutral, focused, smirk, stern, warm, weary | 6 |
| `apparelAccent` | `BustApparelAccent` | none, collar, hood, visor, goggles, headband | 6 |
| `facialHair` | `BustFacialHair` | none, stubble, short-beard, full-beard, goatee | 5 |
| `scar` | `BustScar` | none, cheek-left, cheek-right, brow-left, brow-right, chin | 6 |
| `tattoo` | `BustTattoo` | none, temple-left, temple-right, neck-left, neck-right | 5 |

**Full theoretical combination space (all 11 fields):**
5 × 6 × 6 × 7 × 5 × 7 × 6 × 6 × 5 × 6 × 5 = **238,140,000**

This number rules out full per-combination coverage. The design below handles this.

---

## Asset Strategy

### Approach: Deterministic Filename Lookup

Each asset is a JPEG named by the **exact descriptor values** in a fixed field order. The viewer resolves one exact file per descriptor and shows `not-found - <imagename>` when the asset is missing.

```
public/images/portraits/
  {faceShape}__{skinTone}__{hairStyle}__{hairColor}__{eyeStyle}__{eyeColor}__{expressionPreset}__{apparelAccent}__{facialHair}__{scar}__{tattoo}.jpeg
```

**Delimiter:** double underscore (`__`) between fields, hyphen (`-`) within field values.
**Extension:** `.jpeg` always.
**Example (full path):**
`oval__medium__short-crop__brown__almond__green__focused__collar__none__none__none.jpeg`

The viewer resolves the full 11-field name.

---

## PoC Sample Set

To unblock frontend development and validate the naming scheme end-to-end, generate the following **6 JPEG assets** using an AI image generation tool. These are the current PoC assets already present under `public/images/portraits`.

| Filename | Description |
|---|---|
| `square__pale__long-loose__auburn__round__grey__smirk__headband__none__none__none.jpeg` | Curated sample |
| `round__tan__slicked__red__wide__blue__warm__goggles__none__none__none.jpeg` | Curated sample |
| `round__dark__shaved__white__almond__violet__weary__none__none__none.jpeg` | Curated sample |
| `oval__medium__short-crop__brown__almond__green__focused__collar__none__none__none.jpeg` | Default form state sample |
| `narrow__light__mid-fade__black__narrow__hazel__neutral__hood__none__none__none.jpeg` | Curated sample |
| `angular__deep__braided__silver__hooded__amber__stern__visor__none__none__none.jpeg` | Curated sample |

**Recommended image spec for AI generation:**
- Square crop, 512×512 or 1024×1024
- Bust portrait, head-and-shoulders, front-facing
- Transparent or dark studio background (we can mask in CSS)
- Photorealistic style, neutral studio lighting
- No text, no border, no watermark

**Prompt pack:**
- Midjourney-ready prompt docs can be added later if we decide to regenerate or expand the set.

---

## Viewer Design

### Component: `CharacterPreviewImageComponent`

Replaces `CharacterBustViewerComponent` (3D) and is mounted in the same right-pane slot.

**Inputs:**
- `descriptor: BustDescriptorInput` — same shape as today

**Behavior:**
- Resolves the asset path from the descriptor using the exact filename.
- On descriptor change, cross-fades to the new image (CSS transition, ~300ms).
- Shows a loading state (skeleton) while the JPEG loads.
- Shows `not-found - <imagename>` if the asset is missing.
- Displays the resolved filename in the debug bar (same footer pattern as the 3D viewer).

**No 3D canvas, no WebGL, no OrbitControls.** Angular `OnPush`, signals for state.

### File Location

```
src/app/page/character/components/character-preview-image/
  character-preview-image.ts
  character-preview-image.html
  character-preview-image.css
  character-preview-image.spec.ts
```

### Asset Base Path

`public/images/portraits/` (served as static files, same as models).

---

## Migration Plan

1. Build `CharacterPreviewImageComponent` and its spec.
2. Wire it into `CharacterBustPreviewPaneComponent` in place of `CharacterBustViewerComponent`.
3. Remove `CharacterBustViewerComponent` and its 3D scene geometry, profile computation, and the `character-bust-viewer` directory.
4. Remove unused Three.js / angular-three imports if no other scene uses them (check before deleting).
5. Place the 6 PoC JPEGs under `public/images/portraits/`.
6. Confirm the fallback chain resolves correctly for the default descriptor.
7. Run `npm run build` and focused Playwright tests.

---

## Open Questions (record, not blocking)

- Should `presetVersion` encode the asset generation batch so old descriptors can be re-mapped to updated art without a breaking schema change?
- Should the portraits directory live in `public/portraits/` instead of `src/assets/portraits/` given Angular's asset handling?
