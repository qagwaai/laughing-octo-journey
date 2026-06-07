# `pale.jpeg`

## Purpose

Skin-tone-only fallback asset for pale skin tone.

## Descriptor Coverage

- `skinTone`: `pale`
- Other characteristics intentionally left broad for fallback use.

## Prompt

```text
androgynous human bust portrait, head and shoulders only, facing directly toward the camera, centered symmetrical composition, photorealistic, clear readable pale skin tone, naturally visible irises, neutral expression, believable human facial proportions, grounded Stellar universe aesthetic, restrained starship cockpit backdrop with subtle hard-sci-fi instrumentation and distant stars beyond canopy glass, premium game character portrait, gritty lived-in realism, soft frontal key light, balanced fill light on both sides of the face, gentle catchlights in both eyes, even illumination across forehead, cheeks, nose, and jaw so skin tone reads accurately, dark background friendly, no dramatic top light, no deep eye shadow, no silhouette lighting, no helmet, no mask, no fantasy elements, no text, no watermark, square crop
```

## Notes

- Keep the skin tone distinct from the background and from specular highlights.
- Avoid overcooling the image to the point that pale skin reads grey.
- Iteration note: we have been using this negative tail to suppress unreadable lighting and silhouette drift: `--no overhead halo light --no face in shadow --no glowing scalp --no silhouette portrait --no obscured eyes --no cinematic darkness`.