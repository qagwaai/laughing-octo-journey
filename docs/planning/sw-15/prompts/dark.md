# `dark.jpeg`

## Purpose

Skin-tone-only fallback asset for dark skin tone.

## Descriptor Coverage

- `skinTone`: `dark`
- Other characteristics intentionally left broad for fallback use.

## Prompt

```text
androgynous human bust portrait, head and shoulders only, facing directly toward the camera, centered symmetrical composition, photorealistic, clear readable dark skin tone, naturally visible irises, neutral expression, believable human facial proportions, grounded Stellar universe aesthetic, Stellar mining outpost atmosphere with worn industrial hangar textures and soft machinery glow in the background, faint starfield light from a side opening, premium game character portrait, gritty lived-in realism, soft frontal key light, balanced fill light on both sides of the face, gentle catchlights in both eyes, even illumination across forehead, cheeks, nose, and jaw so skin tone reads accurately, dark background friendly, no dramatic top light, no deep eye shadow, no silhouette lighting, no helmet, no mask, no fantasy elements, no text, no watermark, square crop
```

## Notes

- Keep enough fill on the lower face so the portrait does not collapse into shadow.
- Preserve realistic skin texture without making the image glossy or plastic.
- Iteration note: we have been using this negative tail to suppress unreadable lighting and silhouette drift: `--no overhead halo light --no face in shadow --no glowing scalp --no silhouette portrait --no obscured eyes --no cinematic darkness`.