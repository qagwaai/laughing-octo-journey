# `square__light__mid-fade__silver__narrow__amber__neutral__hood__goatee__brow-right__neck-left.jpeg`

## Purpose

Full-path 11-field descriptor sample chosen to close the largest remaining coverage gaps in the active SW-15 matrix while preserving the established portrait style.

## Descriptor Coverage

- `faceShape`: `square`
- `skinTone`: `light`
- `hairStyle`: `mid-fade`
- `hairColor`: `silver`
- `eyeStyle`: `narrow`
- `eyeColor`: `amber`
- `expressionPreset`: `neutral`
- `apparelAccent`: `hood`
- `facialHair`: `goatee`
- `scar`: `brow-right`
- `tattoo`: `neck-left`

## Prompt

```text
androgynous human bust portrait, square face, light skin tone, silver mid-fade hair, narrow amber eyes, neutral expression, structured sci-fi hood apparel accent resting behind the head and neck without obscuring the hairline or eyes, natural goatee facial hair that is subtle but clearly readable, subtle scar on the right brow, subtle tattoo on the left side of the neck, head and shoulders only, facing directly toward the camera, centered symmetrical composition, medium close-up bust portrait, camera pulled back slightly, entire head fully contained within the frame, clearly visible space above the hair, shoulders and upper chest visible, subject framed with safe top margin, face occupies roughly 60 percent of the image height, not an extreme close-up, not tightly cropped, photorealistic, premium Stellar universe character art, grounded hard-sci-fi, habitat transit junction background with restrained panel glow and distant starfield through reinforced windows, lived-in but high-quality materials, natural facial detail, crisp eye contact, soft frontal key light, balanced fill light on both sides of the face, gentle catchlights in both amber eyes, even illumination across forehead, cheeks, nose, and jaw so skin tone and eye color read accurately, clear readability of goatee texture plus brow-right scar and neck-left tattoo for character customization UI, clean production-ready asset, dark background friendly, no dramatic top light, no deep eye shadow, no silhouette lighting, no helmet, no full mask, no fantasy elements, no text, no watermark, square crop
```

## Notes

- This variant intentionally closes the highest-value uncovered attributes in the balanced coverage matrix.
- Keep `goatee`, `brow-right`, and `neck-left` visible but subtle, avoiding exaggerated stylization.
- Iteration note: we have been using this negative tail to prevent unreadable portrait lighting and cosmic silhouette drift: `--no overhead halo light --no face in shadow --no glowing scalp --no silhouette portrait --no obscured eyes --no cinematic darkness`.
- Framing note: if Midjourney pushes too close, use explicit shot language like `medium close-up bust portrait`, `camera pulled back slightly`, and `face occupies roughly 60 percent of the image height`, plus the negative tail `--no extreme close-up --no tight crop --no cropped scalp --no forehead cut off --no face filling frame`.