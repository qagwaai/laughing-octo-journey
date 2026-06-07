# `oval__tan__long-loose__black__round__hazel__warm__none__short-beard__cheek-right__temple-left.jpeg`

## Purpose

Full-path 11-field descriptor sample that validates planned characteristics (`facialHair`, `scar`, `tattoo`) in the same production style as the existing SW-15 prompt set.

## Descriptor Coverage

- `faceShape`: `oval`
- `skinTone`: `tan`
- `hairStyle`: `long-loose`
- `hairColor`: `black`
- `eyeStyle`: `round`
- `eyeColor`: `hazel`
- `expressionPreset`: `warm`
- `apparelAccent`: `none`
- `facialHair`: `short-beard`
- `scar`: `cheek-right`
- `tattoo`: `temple-left`

## Prompt

```text
androgynous human bust portrait, oval face, tan skin tone, long-loose black hair, round hazel eyes, warm expression, no apparel accent, clean neckline with no collar hood visor goggles or headband, short-beard facial hair that is natural and well-defined, subtle scar on the right cheek, subtle tattoo on the left temple, head and shoulders only, facing directly toward the camera, centered symmetrical composition, medium close-up bust portrait, camera pulled back slightly, entire head fully contained within the frame, clearly visible space above the hair, shoulders and upper chest visible, subject framed with safe top margin, face occupies roughly 60 percent of the image height, not an extreme close-up, not tightly cropped, photorealistic, premium Stellar universe character art, grounded hard-sci-fi, orbital habitat promenade background with restrained interface glow and distant starfield through structural windows, lived-in but high-quality materials, natural facial detail, crisp eye contact, soft frontal key light, balanced fill light on both sides of the face, gentle catchlights in both hazel eyes, even illumination across forehead, cheeks, nose, and jaw so skin tone and eye color read accurately, clear readability of beard texture plus cheek-right scar and temple-left tattoo for character customization UI, clean production-ready asset, dark background friendly, no dramatic top light, no deep eye shadow, no silhouette lighting, no helmet, no full mask, no fantasy elements, no text, no watermark, square crop
```

## Notes

- This variant is intended to prove 11-field prompt coverage in the same visual style as the existing prompt pack.
- Keep `short-beard`, `cheek-right`, and `temple-left` visible but subtle, avoiding exaggerated stylization.
- Iteration note: we have been using this negative tail to prevent unreadable portrait lighting and cosmic silhouette drift: `--no overhead halo light --no face in shadow --no glowing scalp --no silhouette portrait --no obscured eyes --no cinematic darkness`.
- Framing note: if Midjourney pushes too close, use explicit shot language like `medium close-up bust portrait`, `camera pulled back slightly`, and `face occupies roughly 60 percent of the image height`, plus the negative tail `--no extreme close-up --no tight crop --no cropped scalp --no forehead cut off --no face filling frame`.