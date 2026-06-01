# Blueprint Authoring Rules

## Goal

Keep blueprint drawings visually readable while scaling to many items.
The key principle is strict separation of:

1. Geometry layer (the technical drawing)
2. Meta layer (dimensions, labels, status tags)

## Canonical Layout Contract

Use a fixed 1400 x 840 SVG viewBox and reserve non-overlapping zones.

- Top meta rail: y = 0 to 120
- Bottom meta rail: y = 680 to 840
- Left side rail: x = 0 to 120
- Right side rail: x = 1280 to 1400
- Geometry safe zone: x = 120 to 1280, y = 120 to 680

Rules:

1. No geometry primitives in rails.
2. No meta text in geometry safe zone unless it is a short callout tied to a leader line.
3. Long-form measurements must be in top/bottom rails.
4. Vertical dimension text belongs only in left/right rails.
5. Each rail keeps at least 16 px inner padding.

## Layering Rules

Inside each blueprint SVG, keep this structure order:

1. defs (gradients, filters)
2. geometry group
3. callout leaders group
4. labels group

Label rules:

- Use monospace font
- Font size 22 to 24 for headline dimensions
- Max line length target: 32 characters
- Prefer uppercase for dimension labels
- Keep 1.2 letter spacing to match style language

## Naming and Asset Rules

For item type "my-item-type":

- Overlay SVG: images/my_item_type_blueprint_overlay.svg
- Legacy fallback PNG (optional): images/my_item_type_specs.png
- Background (shared allowed): images/scavenger_pod_blueprint_bg.png

Always use snake_case file names.

## Data/Config Rules in App

In item view specs config:

1. If an item has a custom blueprint, always set blueprintImagePath explicitly.
2. Provide labels[] only for meta chips that are meant for rails.
3. Do not duplicate long dimension text in both SVG center and overlay labels.
4. Keep item-specific unitLine/classificationLine/footerTag concise and consistent.

## Recommended Meta Separation Strategy

Use a two-channel metadata model going forward.

Channel A: In-SVG technical callouts
- Short labels near leader lines only
- Kept inside or near safe zone boundary

Channel B: Component-level meta rails
- Rendered outside image geometry in HTML/CSS
- Reserved areas in the page shell for dimensions and system notes

Practical implementation shape:

- topMeta: 2 to 3 dimension chips
- sideMetaLeft: optional vertical dimensions
- sideMetaRight: optional vertical dimensions
- footerMeta: 1 to 2 tags

This avoids overlap because rails are not part of drawable geometry.

## Suggested Component Contract (Forward-Compatible)

Add optional fields to blueprint config:

- topMeta?: string[]
- sideMetaLeft?: string[]
- sideMetaRight?: string[]
- footerMeta?: string[]

Rendering behavior:

1. If meta arrays exist, render rails and suppress overlapping free-form labels.
2. If not present, use existing labels[] behavior for backward compatibility.

## Quality Gate Checklist (Before Commit)

1. Open blueprint at desktop width and verify no overlap.
2. Open blueprint at mobile breakpoint and verify rails remain readable.
3. Confirm configured blueprintImagePath resolves to an existing asset.
4. Verify no fallback "Image not found" appears after first and second navigation.
5. Run focused specs touching:
   - item-view-specs component
   - item-view-specs configs

## Starter Template for New Blueprint SVGs

Use this skeleton and keep geometry inside safe zone:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1400 840" role="img" aria-label="Item blueprint overlay">
  <defs>
    <!-- gradients/filters -->
  </defs>

  <g id="geometry" fill="none" stroke="url(#lineGlow)">
    <!-- draw only in x:120-1280, y:120-680 -->
  </g>

  <g id="callout-leaders" fill="none" stroke="url(#lineGlow)">
    <!-- short leader lines -->
  </g>

  <g id="labels" fill="#c8f0ff" font-size="24" font-family="monospace" letter-spacing="1.2">
    <!-- top rail labels -->
    <!-- side rail labels -->
    <!-- bottom rail labels -->
  </g>
</svg>
```

## Migration Plan for Existing Blueprints

1. Keep current assets working as-is.
2. For each new item, adopt rail-based layout from day one.
3. For existing items, migrate when touched for other work.
4. Remove duplicate center-overlap labels during migration.
