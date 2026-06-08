# SW-15 Balanced Coverage Matrix

This document tracks coverage across the active 11-field portrait descriptor set defined in [docs/planning/sw-15/sw-15-m2a1-character-preview-2d-design.md](c:/Development/Projects/Github/laughing-octo-journey/docs/planning/sw-15/sw-15-m2a1-character-preview-2d-design.md).

## Scope

- Focus on the active 11-field exact-filename contract.
- Treat legacy 8-field prompt docs as style references, not full contract coverage.
- Use this matrix to pick the next prompt combinations so missing values are filled deliberately.

## Current 11-Field Sample Set

| Filename | Face | Skin | Hair Style | Hair Color | Eye Style | Eye Color | Expression | Apparel | Facial Hair | Scar | Tattoo |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `square__pale__long-loose__auburn__round__grey__smirk__headband__none__none__none.jpeg` | square | pale | long-loose | auburn | round | grey | smirk | headband | none | none | none |
| `round__tan__slicked__red__wide__blue__warm__goggles__none__none__none.jpeg` | round | tan | slicked | red | wide | blue | warm | goggles | none | none | none |
| `round__dark__shaved__white__almond__violet__weary__none__none__none.jpeg` | round | dark | shaved | white | almond | violet | weary | none | none | none | none |
| `oval__medium__short-crop__brown__almond__green__focused__collar__none__none__none.jpeg` | oval | medium | short-crop | brown | almond | green | focused | collar | none | none | none |
| `oval__tan__long-loose__black__round__hazel__warm__none__short-beard__cheek-right__temple-left.jpeg` | oval | tan | long-loose | black | round | hazel | warm | none | short-beard | cheek-right | temple-left |
| `angular__deep__braided__blonde__hooded__blue__stern__collar__stubble__brow-left__neck-right.jpeg` | angular | deep | braided | blonde | hooded | blue | stern | collar | stubble | brow-left | neck-right |
| `narrow__deep__short-crop__auburn__almond__grey__smirk__goggles__full-beard__cheek-left__temple-right.jpeg` | narrow | deep | short-crop | auburn | almond | grey | smirk | goggles | full-beard | cheek-left | temple-right |
| `square__light__mid-fade__silver__narrow__amber__neutral__hood__goatee__brow-right__neck-left.jpeg` | square | light | mid-fade | silver | narrow | amber | neutral | hood | goatee | brow-right | neck-left |
| `round__medium__slicked__black__hooded__brown__focused__visor__none__chin__none.jpeg` | round | medium | slicked | black | hooded | brown | focused | visor | none | chin | none |

## Coverage Status By Field

### Fully Covered Fields

| Field | Status | Notes |
|---|---|---|
| `faceShape` | complete | All 5 values represented. |

### Partial Fields And Gaps

| Field | Covered Values | Missing Values | Priority |
|---|---|---|---|
| `skinTone` | pale, light, medium, tan, dark, deep | none | complete |
| `hairStyle` | short-crop, mid-fade, long-loose, braided, shaved, slicked | none | complete |
| `hairColor` | black, brown, auburn, blonde, silver, white, red | none | complete |
| `eyeStyle` | narrow, round, wide, almond, hooded | none | complete |
| `eyeColor` | brown, hazel, green, blue, grey, violet, amber | none | complete |
| `expressionPreset` | neutral, focused, smirk, stern, warm, weary | none | complete |
| `apparelAccent` | none, collar, hood, visor, goggles, headband | none | complete |
| `facialHair` | none, stubble, short-beard, full-beard, goatee | none | complete |
| `scar` | none, cheek-left, cheek-right, brow-left, brow-right, chin | none | complete |
| `tattoo` | none, temple-left, temple-right, neck-left, neck-right | none | complete |

## Balance Observations

- The matrix now covers every value across all 11 active descriptor fields at least once.
- Future prompts can optimize for pair coverage, visual diversity, and quality comparisons rather than raw value completion.
- `square` and `round` now appear twice each, while `angular`, `oval`, and `narrow` remain balanced enough for prompt planning.
- The next prompt can be more surgical because first-pass value coverage is complete.

## Recommended Next Prompt Queue

These are the next best candidates for balanced coverage because each one closes multiple open gaps at once.

| Priority | Target Filename | Gaps Closed |
|---|---|---|
| 1 | `angular__pale__braided__white__wide__green__weary__headband__short-beard__none__temple-right.jpeg` | rebalances pale/wide/weary with existing details |
| 2 | `oval__dark__long-loose__red__round__hazel__warm__none__stubble__cheek-right__neck-right.jpeg` | strengthens dark/no-apparel coverage with known readable traits |
| 3 | `narrow__tan__shaved__blonde__almond__blue__stern__collar__goatee__chin__neck-left.jpeg` | reinforces rare trait pairings with already-covered values |
| 4 | `square__medium__mid-fade__brown__narrow__amber__neutral__visor__stubble__brow-left__none.jpeg` | stresses newly completed values in a cleaner comparison frame |

## Selection Rule For Future Prompts

When choosing the next prompt:

1. Prefer combinations that close at least 3 currently missing values.
2. Avoid repeating the same `skinTone` + `apparelAccent` pair in consecutive prompts.
3. Keep `scar` and `tattoo` subtle when they are present so they do not overpower face, skin, eye, and expression readability.
4. Use `none` deliberately for accessory or marking fields only when it improves balance, not by default.
5. Reuse the existing prompt style and framing guardrails so visual comparisons stay valid.

## Status

- Matrix status: started
- Current full 11-field documented samples: 9
- Highest-value next balancing prompt: `angular__pale__braided__white__wide__green__weary__headband__short-beard__none__temple-right.jpeg`