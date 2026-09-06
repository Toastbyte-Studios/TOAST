# ColdBoot brand assets

Mark: a lug-sole bootprint with a power ring pressed into the arch. Ground is
"Glacier" — pale ice in light mode, deep slate in dark. Everything here is
generated from one 120×120 path set, so the vectors are the source of truth.

## Palette

| Role | Light | Dark |
| --- | --- | --- |
| Brand | `#2F5875` | `#8FB6CE` |
| Background | `#DCECF7` | `#101B24` |
| Surface | `#F7FAFC` | `#17232E` |
| Text | `#1D1F20` | `#DCECF7` |
| Border | `#A9C5DA` | `#2C4256` |
| Muted | `#557286` | `#8CA3B4` |
| Signal (accent) | `#B45309` | `#FFB020` |
| Confirmed | `#2F6F7A` | `#5E9BA8` |

Icon tile gradients: light `150deg #DCECF7 → #A9C5DA`, dark `150deg #2F4F6B → #1B2F42`.

## Contents

- `svg/icon-light.svg`, `svg/icon-dark.svg` — app icon, full tread. Use at 64px and up.
- `svg/icon-light-small.svg`, `svg/icon-dark-small.svg` — three-chevron tread for 48px and below.
- `svg/mark-*.svg` — the print alone on transparent, ink and ice, full and simplified.
- `svg/lockup-light.svg`, `svg/lockup-dark.svg` — mark + COLDBOOT wordmark (Barlow Condensed 600; the file references the font by name, so install it or convert the text to outlines before handing to a printer).
- `svg/favicon.svg` — simplified tile.
- `png/light/`, `png/dark/` — 1024, 512, 192, 180, 167, 152, 120, 96, 64, 48, 32, 16 (light) and 1024, 512, 192, 96, 64, 32, 16 (dark). 32 and 16 use the simplified tread.
- `png/favicon-32.png`, `png/favicon-16.png`.
- `png/mark/` — transparent prints at 1024 and 64.
- `android/adaptive-icon-foreground.(svg|png)` + `adaptive-icon-background.(svg|png)` — 432×432, print scaled to the 66% safe zone.
- `theme/colors.ts` — drop-in replacement for `src/theme/colors.ts` on `feat/coldboot-theme-tokens`.
- `theme/tokens.json`, `theme/tokens.css` — same values for non-RN consumers.

## Small sizes

Below 48px the five-chevron forefoot fills in. Ship the `-small` variants for
favicons, notification icons and tab bars; they carry three heavier chevrons
and a slightly larger power ring.

## Not included

- iOS `.icns` / Windows `.ico` containers — say the word and I'll add them.
- The wordmark as outlines (needs the licensed font file to convert).
