# `oval__medium__short-crop__brown__almond__green__focused__collar.jpeg`

## Purpose

Full default-path descriptor sample aligned to the SW-15 naming scheme.

## Descriptor Coverage

- `faceShape`: `oval`
- `skinTone`: `medium`
- `hairStyle`: `short-crop`
- `hairColor`: `brown`
- `eyeStyle`: `almond`
- `eyeColor`: `green`
- `expressionPreset`: `focused`
- `apparelAccent`: `collar`

## Prompt

```text
androgynous human bust portrait, oval face, medium skin tone, short-crop brown hair, almond-shaped green eyes, focused expression, structured sci-fi collar apparel, head and shoulders only, facing directly toward the camera, centered symmetrical composition, medium close-up bust portrait, camera pulled back slightly, entire head fully contained within the frame, clearly visible space above the hair, shoulders and upper chest visible, subject framed with safe top margin, face occupies roughly 60 percent of the image height, not an extreme close-up, not tightly cropped, photorealistic, premium Stellar universe character art, grounded hard-sci-fi, orbital station command interior background with subtle holographic interface glow and nebula visible through reinforced glass, lived-in but high-quality materials, natural facial detail, crisp eye contact, soft frontal key light, balanced fill light on both sides of the face, gentle catchlights in both green eyes, even illumination across forehead, cheeks, nose, and jaw so skin tone and eye color read accurately, clean production-ready asset for a character customization UI, dark background friendly, no dramatic top light, no deep eye shadow, no silhouette lighting, no helmet, no full mask, no fantasy elements, no text, no watermark, square crop
```

## Notes

- This is the anchor prompt for the current default descriptor example in the SW-15 brief.
- If Midjourney drifts toward shaved hair, increase the weight on `short-crop brown hair` and `structured sci-fi collar apparel`.
- Iteration note: we have been using this negative tail to prevent unreadable portrait lighting and cosmic silhouette drift: `--no overhead halo light --no face in shadow --no glowing scalp --no silhouette portrait --no obscured eyes --no cinematic darkness`.
- Framing note: if Midjourney pushes too close, use explicit shot language like `medium close-up bust portrait`, `camera pulled back slightly`, and `face occupies roughly 60 percent of the image height`, plus the negative tail `--no extreme close-up --no tight crop --no cropped scalp --no forehead cut off --no face filling frame`.