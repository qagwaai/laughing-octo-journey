# `narrow__light__mid-fade__black__narrow__hazel__neutral__hood.jpeg`

## Purpose

Fourth full-path descriptor sample with a lower-chroma, grounded look to test trait readability without strong color contrast.

## Descriptor Coverage

- `faceShape`: `narrow`
- `skinTone`: `light`
- `hairStyle`: `mid-fade`
- `hairColor`: `black`
- `eyeStyle`: `narrow`
- `eyeColor`: `hazel`
- `expressionPreset`: `neutral`
- `apparelAccent`: `hood`

## Prompt

```text
androgynous human bust portrait, narrow face, light skin tone, black mid-fade hair, narrow hazel eyes, neutral expression, structured sci-fi hood apparel accent resting behind the head and neck without obscuring hairline or facial features, head and shoulders only, facing directly toward the camera, centered symmetrical composition, medium close-up bust portrait, camera pulled back slightly, entire head fully contained within the frame, clearly visible space above the hair, shoulders and upper chest visible, subject framed with safe top margin, face occupies roughly 60 percent of the image height, not an extreme close-up, not tightly cropped, photorealistic, premium Stellar universe character art, grounded hard-sci-fi, docking bay control alcove background with restrained instrument glow and distant stars through reinforced glass, lived-in but high-quality materials, natural facial detail, crisp eye contact, soft frontal key light, balanced fill light on both sides of the face, gentle catchlights in both hazel eyes, even illumination across forehead, cheeks, nose, and jaw so skin tone and eye color read accurately, clean production-ready asset for a character customization UI, dark background friendly, no dramatic top light, no deep eye shadow, no silhouette lighting, no helmet, no full mask, no fantasy elements, no text, no watermark, square crop
```

## Notes

- This variant intentionally reduces color intensity so descriptor readability depends on shape, tone, and lighting clarity.
- Keep hood as an apparel accent only; do not let it cast deep shadows across the eyes.
- Iteration note: we have been using this negative tail to prevent unreadable portrait lighting and cosmic silhouette drift: `--no overhead halo light --no face in shadow --no glowing scalp --no silhouette portrait --no obscured eyes --no cinematic darkness`.
- Framing note: if Midjourney pushes too close, use explicit shot language like `medium close-up bust portrait`, `camera pulled back slightly`, and `face occupies roughly 60 percent of the image height`, plus the negative tail `--no extreme close-up --no tight crop --no cropped scalp --no forehead cut off --no face filling frame`.