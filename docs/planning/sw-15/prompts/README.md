# SW-15 Prompt Pack

This directory contains Midjourney-ready prompt docs for the six proof-of-technology portrait assets defined in the SW-15 M3 2D character preview brief.

## Prompt Rules

- Keep the portrait front-facing and centered.
- Keep descriptor traits readable at UI thumbnail size.
- Use grounded Stellar hard-sci-fi backgrounds, not abstract fantasy imagery.
- Keep the subject androgynous unless facial hair is intentionally specified.
- Favor balanced portrait lighting over moody silhouette lighting so `skinTone`, `eyeColor`, and expression remain visible.

## Recommended Midjourney Tail

Append this to any prompt when needed:

```text
front view, looking into camera, centered face, symmetrical portrait, UI-readable portrait lighting, descriptor traits must be clearly legible: skin tone, eye color, hair color, expression --ar 1:1 --stylize 125 --v 7 --no side profile --no profile view --no turned head --no overhead halo light --no face in shadow --no silhouette portrait --no obscured eyes --no text --no watermark
```

## Current Negative Prompt Notes

We have been using this negative prompt tail during iteration to suppress unreadable lighting and silhouette drift:

```text
--no overhead halo light --no face in shadow --no glowing scalp --no silhouette portrait --no obscured eyes --no cinematic darkness
```

## Files

- `placeholder.md`
- `medium.md`
- `pale.md`
- `dark.md`
- `oval__medium__short-crop__brown__almond__green__focused__collar.md`
- `angular__deep__braided__silver__hooded__amber__stern__visor.md`
- `round__tan__slicked__red__wide__blue__warm__goggles.md`
- `narrow__light__mid-fade__black__narrow__hazel__neutral__hood.md`
- `square__pale__long-loose__auburn__round__grey__smirk__headband.md`
- `round__dark__shaved__white__almond__violet__weary__none.md`
- `oval__medium__short-crop__brown.md`

Each file includes the target JPEG filename, descriptor coverage, and a prompt tuned for front-facing bust generation in the Stellar setting.