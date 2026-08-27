# `placeholder.jpeg`

## Purpose

Fallback placeholder asset for cases where no portrait resolves.

## Descriptor Coverage

Not descriptor-specific. This asset should read as intentionally generic.

## Prompt

```text
minimal high-end sci-fi character placeholder image, androgynous human bust, head and shoulders only, facing directly toward the camera, centered front-facing portrait, symmetrical composition, elegant anonymous face visible from the front, subtle Stellar universe design language, grounded hard-sci-fi, faint orbital station glow, restrained starfield through glass, dark background, clean readable shape for UI fallback asset, premium game portrait placeholder, soft rim light plus gentle front fill light so both eyes, nose, and mouth are visible, minimal facial detail, no strong profile angle, no side view, no three-quarter view, no helmet, no mask, no fantasy elements, no text, no watermark, no border, square crop
```

## Notes

- Keep the silhouette readable even when displayed small.
- Avoid lighting setups that turn the image into a side-profile or abstract cosmic icon.
- Iteration note: we have been using this negative tail to suppress unreadable lighting and silhouette drift: `--no overhead halo light --no face in shadow --no glowing scalp --no silhouette portrait --no obscured eyes --no cinematic darkness`.