# Character Avatar UX Decision Record

- Date: 2026-04-26
- Status: Accepted
- Scope: All in-game pages that previously displayed Player and Character context labels

## Context

Every game page (game-main, fabrication-lab, market-hub, repair-retrofit, stellar-initiation, character-profile, ship-hangar, ship-view-inventory, ship-view-specs, game-join) displayed the active player and character identity as plain text rows at the top of the content pane:

```
Player: <playerName>
Character: <characterName>
```

These labels added vertical clutter to every page header, restated information the player already knows, and provided no affordance for acting on that information.

## Decision

Remove the `Player:` label entirely from all game pages. Replace both labels with a compact character avatar icon in the top-right corner of the page header:

- A filled circle (2.5 rem, blue `#3d6bbd`) displaying the first initial of the character name in uppercase.
- The full character name appears as a tooltip (`title` attribute) on hover.
- Tapping or clicking the avatar navigates to the character-profile page, passing the current `playerName` and `joinCharacter` as navigation state.
- The `Character:` text label was also removed, since the avatar makes the character identity visible at all times without consuming a full text row.
- The page `<h1>` and subtitle are wrapped in a `page-header` flex row alongside the avatar so the layout is consistent across all pages.

## Rationale

- Reduces header clutter: two lines of identity text become a single compact icon.
- The initial is sufficient for recognition within a single session where the player chose the character moments earlier.
- Placing the avatar in the top-right follows common app conventions (account/profile affordance in the corner).
- Making the avatar a navigation shortcut to character-profile adds utility without adding visual weight.
- Player name is session-level infrastructure, not something the player needs to read on every page; removing it declutters without losing any functional information.

## Implementation

- `.page-header` (flexbox, `space-between`) and `.character-avatar` styles added to `src/styles.css` as shared global styles to avoid repetition across 10 component files.
- `navigateToCharacterProfile()` method added to all 10 affected page components.
- Avatar is rendered only when `joinCharacter()` is non-null, so pages visited before character selection are unaffected.
