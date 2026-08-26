# `narrow__deep__short-crop__auburn__almond__grey__smirk__goggles__full-beard__cheek-left__temple-right.jpeg`

## Purpose

Full-path 11-field descriptor sample that tests a narrower facial structure, fuller facial hair, and opposite-side scar and tattoo placement while staying inside the established SW-15 portrait style.

## Descriptor Coverage

- `faceShape`: `narrow`
- `skinTone`: `deep`
- `hairStyle`: `short-crop`
- `hairColor`: `auburn`
- `eyeStyle`: `almond`
- `eyeColor`: `grey`
- `expressionPreset`: `smirk`
- `apparelAccent`: `goggles`
- `facialHair`: `full-beard`
- `scar`: `cheek-left`
- `tattoo`: `temple-right`

## Prompt

```text
androgynous human bust portrait, narrow face, deep skin tone, short-crop auburn hair, almond-shaped grey eyes, subtle smirk expression, compact sci-fi goggles resting low at the collar line as an apparel accent without covering the eyes or jawline, natural full-beard facial hair that is well-defined and clearly readable, subtle scar on the left cheek, subtle tattoo on the right temple, head and shoulders only, facing directly toward the camera, centered symmetrical composition, medium close-up bust portrait, camera pulled back slightly, entire head fully contained within the frame, clearly visible space above the hair, shoulders and upper chest visible, subject framed with safe top margin, face occupies roughly 60 percent of the image height, not an extreme close-up, not tightly cropped, photorealistic, premium Stellar universe character art, grounded hard-sci-fi, shipboard observation corridor background with restrained console glow and faint starfield through reinforced windows, lived-in but high-quality materials, natural facial detail, crisp eye contact, soft frontal key light, balanced fill light on both sides of the face, gentle catchlights in both grey eyes, even illumination across forehead, cheeks, nose, and jaw so skin tone and eye color read accurately, clear readability of beard texture plus cheek-left scar and temple-right tattoo for character customization UI, clean production-ready asset, dark background friendly, no dramatic top light, no deep eye shadow, no silhouette lighting, no helmet, no full mask, no fantasy elements, no text, no watermark, square crop
```

## Notes

- This variant is intended to prove that fuller facial hair and asymmetrical markings remain readable without overpowering the core descriptor traits.
- Keep `full-beard`, `cheek-left`, and `temple-right` visible but subtle, avoiding exaggerated stylization.
- Iteration note: we have been using this negative tail to prevent unreadable portrait lighting and cosmic silhouette drift: `--no overhead halo light --no face in shadow --no glowing scalp --no silhouette portrait --no obscured eyes --no cinematic darkness`.
- Framing note: if Midjourney pushes too close, use explicit shot language like `medium close-up bust portrait`, `camera pulled back slightly`, and `face occupies roughly 60 percent of the image height`, plus the negative tail `--no extreme close-up --no tight crop --no cropped scalp --no forehead cut off --no face filling frame`.