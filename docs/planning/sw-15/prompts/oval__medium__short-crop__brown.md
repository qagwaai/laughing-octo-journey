# `oval__medium__short-crop__brown.jpeg`

## Purpose

4-field fallback sample aligned to the SW-15 fallback chain.

## Descriptor Coverage

- `faceShape`: `oval`
- `skinTone`: `medium`
- `hairStyle`: `short-crop`
- `hairColor`: `brown`
- Eye details, expression, and apparel intentionally omitted for fallback use.

## Prompt

```text
androgynous human bust portrait, oval face, medium skin tone, short-crop brown hair, neutral but alert expression, head and shoulders only, facing directly toward the camera, centered symmetrical composition, photorealistic, grounded Stellar industrial hangar backdrop, hard-sci-fi atmosphere, soft metallic reflections, distant ship silhouettes and faint starfield light beyond an open bay, premium game portrait, gritty lived-in realism, natural skin texture, soft frontal key light, balanced fill light on both sides of the face, gentle catchlights in both eyes, even illumination across forehead, cheeks, nose, and jaw so skin tone remains readable, clean production-ready asset for a character customization UI, dark background friendly, no dramatic top light, no deep eye shadow, no silhouette lighting, no helmet, no full mask, no fantasy elements, no text, no watermark, square crop
```

## Notes

- Keep this image less specific than the full 8-field sample so it works as a broad fallback.
- The result should still read as the same base character family as the full-path sample.
- Iteration note: we have been using this negative tail to suppress unreadable lighting and silhouette drift: `--no overhead halo light --no face in shadow --no glowing scalp --no silhouette portrait --no obscured eyes --no cinematic darkness`.