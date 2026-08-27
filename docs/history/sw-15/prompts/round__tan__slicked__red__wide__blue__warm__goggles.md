# `round__tan__slicked__red__wide__blue__warm__goggles.jpeg`

## Purpose

Third full-path descriptor sample designed to maximize visual contrast from existing stern/focused variants.

## Descriptor Coverage

- `faceShape`: `round`
- `skinTone`: `tan`
- `hairStyle`: `slicked`
- `hairColor`: `red`
- `eyeStyle`: `wide`
- `eyeColor`: `blue`
- `expressionPreset`: `warm`
- `apparelAccent`: `goggles`

## Prompt

```text
androgynous human bust portrait, round face, tan skin tone, slicked red hair, wide blue eyes, warm expression, compact sci-fi goggles resting on the upper collar line as an apparel accent without covering the eyes, head and shoulders only, facing directly toward the camera, centered symmetrical composition, medium close-up bust portrait, camera pulled back slightly, entire head fully contained within the frame, clearly visible space above the hair, shoulders and upper chest visible, subject framed with safe top margin, face occupies roughly 60 percent of the image height, not an extreme close-up, not tightly cropped, photorealistic, premium Stellar universe character art, grounded hard-sci-fi, station concourse background with subtle navigation displays and distant starfield through structural windows, lived-in but high-quality materials, natural facial detail, crisp eye contact, soft frontal key light, balanced fill light on both sides of the face, gentle catchlights in both blue eyes, even illumination across forehead, cheeks, nose, and jaw so skin tone and eye color read accurately, clean production-ready asset for a character customization UI, dark background friendly, no dramatic top light, no deep eye shadow, no silhouette lighting, no helmet, no full mask, no fantasy elements, no text, no watermark, square crop
```

## Notes

- This variant intentionally explores warmer affect (`warm`) and higher chroma contrast (`red` hair + `blue` eyes) for trait legibility testing.
- Keep goggles as a non-occluding accent and avoid converting them into a helmet or visor.
- Iteration note: we have been using this negative tail to prevent unreadable portrait lighting and cosmic silhouette drift: `--no overhead halo light --no face in shadow --no glowing scalp --no silhouette portrait --no obscured eyes --no cinematic darkness`.
- Framing note: if Midjourney pushes too close, use explicit shot language like `medium close-up bust portrait`, `camera pulled back slightly`, and `face occupies roughly 60 percent of the image height`, plus the negative tail `--no extreme close-up --no tight crop --no cropped scalp --no forehead cut off --no face filling frame`.