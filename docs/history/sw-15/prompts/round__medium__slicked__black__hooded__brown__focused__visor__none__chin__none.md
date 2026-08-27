# `round__medium__slicked__black__hooded__brown__focused__visor__none__chin__none.jpeg`

## Purpose

Full-path 11-field descriptor sample chosen to close the last major uncovered value gaps in the active SW-15 matrix while preserving the established portrait style.

## Descriptor Coverage

- `faceShape`: `round`
- `skinTone`: `medium`
- `hairStyle`: `slicked`
- `hairColor`: `black`
- `eyeStyle`: `hooded`
- `eyeColor`: `brown`
- `expressionPreset`: `focused`
- `apparelAccent`: `visor`
- `facialHair`: `none`
- `scar`: `chin`
- `tattoo`: `none`

## Prompt

```text
androgynous human bust portrait, round face, medium skin tone, slicked black hair, hooded brown eyes, focused expression, sleek sci-fi visor apparel accent integrated above the brow without covering the eyes, no facial hair, subtle scar on the chin, no tattoo, head and shoulders only, facing directly toward the camera, centered symmetrical composition, medium close-up bust portrait, camera pulled back slightly, entire head fully contained within the frame, clearly visible space above the hair, shoulders and upper chest visible, subject framed with safe top margin, face occupies roughly 60 percent of the image height, not an extreme close-up, not tightly cropped, photorealistic, premium Stellar universe character art, grounded hard-sci-fi, orbital traffic control backdrop with restrained instrument glow and distant starfield through reinforced glass, lived-in but high-quality materials, natural facial detail, crisp eye contact, soft frontal key light, balanced fill light on both sides of the face, gentle catchlights in both brown eyes, even illumination across forehead, cheeks, nose, and jaw so skin tone and eye color read accurately, clear readability of chin scar and visor silhouette for character customization UI, clean production-ready asset, dark background friendly, no dramatic top light, no deep eye shadow, no silhouette lighting, no helmet, no full mask, no fantasy elements, no text, no watermark, square crop
```

## Notes

- This variant intentionally closes the remaining first-pass uncovered values for `eyeColor`, `apparelAccent`, and `scar`.
- Keep `visor` as a visible accent and `chin` scar subtle, avoiding exaggerated stylization.
- Iteration note: we have been using this negative tail to prevent unreadable portrait lighting and cosmic silhouette drift: `--no overhead halo light --no face in shadow --no glowing scalp --no silhouette portrait --no obscured eyes --no cinematic darkness`.
- Framing note: if Midjourney pushes too close, use explicit shot language like `medium close-up bust portrait`, `camera pulled back slightly`, and `face occupies roughly 60 percent of the image height`, plus the negative tail `--no extreme close-up --no tight crop --no cropped scalp --no forehead cut off --no face filling frame`.