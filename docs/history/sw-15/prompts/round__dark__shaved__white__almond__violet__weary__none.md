# `round__dark__shaved__white__almond__violet__weary__none.jpeg`

## Purpose

Sixth full-path descriptor sample that validates low-accessory styling (`none`) while testing high-contrast eye and hair color against a dark skin tone.

## Descriptor Coverage

- `faceShape`: `round`
- `skinTone`: `dark`
- `hairStyle`: `shaved`
- `hairColor`: `white`
- `eyeStyle`: `almond`
- `eyeColor`: `violet`
- `expressionPreset`: `weary`
- `apparelAccent`: `none`

## Prompt

```text
androgynous human bust portrait, round face, dark skin tone, shaved white hair, almond-shaped violet eyes, weary expression, no apparel accent, clean neck and shoulder line with no collar hood visor goggles or headband, head and shoulders only, facing directly toward the camera, centered symmetrical composition, medium close-up bust portrait, camera pulled back slightly, entire head fully contained within the frame, clearly visible space above the hair, shoulders and upper chest visible, subject framed with safe top margin, face occupies roughly 60 percent of the image height, not an extreme close-up, not tightly cropped, photorealistic, premium Stellar universe character art, grounded hard-sci-fi, quiet maintenance corridor background with restrained utility lights and distant starfield through small reinforced windows, lived-in but high-quality materials, natural facial detail, crisp eye contact, soft frontal key light, balanced fill light on both sides of the face, gentle catchlights in both violet eyes, even illumination across forehead, cheeks, nose, and jaw so skin tone and eye color read accurately, clean production-ready asset for a character customization UI, dark background friendly, no dramatic top light, no deep eye shadow, no silhouette lighting, no helmet, no full mask, no fantasy elements, no text, no watermark, square crop
```

## Notes

- This variant intentionally validates `apparelAccent: none` so the pipeline does not rely on costume elements for visual interest.
- Keep the `weary` expression subtle and grounded, not exaggerated sadness.
- Iteration note: we have been using this negative tail to prevent unreadable portrait lighting and cosmic silhouette drift: `--no overhead halo light --no face in shadow --no glowing scalp --no silhouette portrait --no obscured eyes --no cinematic darkness`.
- Framing note: if Midjourney pushes too close, use explicit shot language like `medium close-up bust portrait`, `camera pulled back slightly`, and `face occupies roughly 60 percent of the image height`, plus the negative tail `--no extreme close-up --no tight crop --no cropped scalp --no forehead cut off --no face filling frame`.