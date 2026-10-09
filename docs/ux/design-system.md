# Design system

Calm, modern and restrained. Cultural identity comes from terminology, content, typography and a single subtle
motif (✦ star mark) — not from saturated color, gradients or heavy decoration.

Source: `packages/design-tokens` → `css/tokens.css` (web, generated) and `@myvedicstar/design-tokens` values (mobile).

## Color (semantic)

| Token                                           | Light                             | Dark                              | Use                                             |
| ----------------------------------------------- | --------------------------------- | --------------------------------- | ----------------------------------------------- |
| `background`                                    | `#FAF8F5` warm white              | `#11151C`                         | page                                            |
| `surface` / `surfaceElevated` / `surfaceSubtle` | `#FFFFFF` / `#FFFFFF` / `#F3F0EB` | `#1A1F28` / `#222834` / `#161B23` | cards, sheets, quiet areas                      |
| `primary` / `onPrimary`                         | `#1E2A44` deep navy / white       | `#B4C8EA` / `#0F1724`             | primary actions, headings                       |
| `secondary` / `onSecondary`                     | `#2B6862` muted teal / white      | `#7CC4BC` / `#0C1C1A`             | secondary accents                               |
| `textPrimary` / `textSecondary`                 | `#1A2233` / `#4F5B6B`             | `#ECEFF4` / `#A9B3C1`             | text                                            |
| `border` / `borderStrong`                       | `#DDD8D0` / `#857D72`             | `#323A47` / `#6F7A8A`             | dividers / input & control borders              |
| `focus`                                         | `#2B5C8A`                         | `#8DB8E6`                         | focus ring                                      |
| `favorableStrong` + `favorableStrongSurface`    | `#035A2B` dark green              | `#B4EBC3`                         | Highly Favorable                                |
| `favorable` + `favorableSurface`                | `#2E6843` botanical green         | `#86CC9C`                         | ✓ Favorable periods/day                         |
| `warning` + `warningSurface`                    | `#9A4D00` orange                  | `#F2A65A`                         | Mixed, Caution, resolved conflicts              |
| `caution` + `cautionSurface`                    | `#A0432D` terracotta              | `#F0A08A`                         | Avoid, "Use caution", "Traditionally avoided"   |
| `auspicious` + `auspiciousSurface`              | `#845C12` amber                   | `#E2BD6E`                         | Brahma/Abhijit Muhurta, Amrit Kalam, brand mark |
| `info` + `infoSurface`                          | `#2B5C8A` calm blue               | `#8DB8E6`                         | information, links                              |
| `error` + `errorSurface`                        | `#B3261E`                         | `#F2B8B5`                         | errors                                          |

All foreground/background pairs are contrast-tested (AA). Status always uses **icon + text + color**.

## Scales

| Scale                     | Values                                                                               |
| ------------------------- | ------------------------------------------------------------------------------------ |
| Spacing (px → rem on web) | 0, 2, 4, 8, 12, 16, 24, 32, 48, 64                                                   |
| Font size                 | 12, 14, 16, 18, 22, 28, 36 (display; web hero uses fluid `clamp`)                    |
| Font weight               | 400, 500, 600, 700                                                                   |
| Line height               | 1.2 tight, 1.35 snug, 1.5 normal, 1.65 relaxed (Indic scripts need generous leading) |
| Radius                    | 6, 10, 16, pill                                                                      |
| Elevation                 | none, low, medium, high (subtle shadows; Android elevation 0/1/3/8)                  |
| Icon size                 | 16, 20, 24, 32                                                                       |
| Touch target              | 44 minimum, 48 comfortable                                                           |
| Motion                    | 120 / 200 / 320 ms, standard easing; zero under reduced motion                       |
| Layout                    | content max 1200 px, readable 70ch, gutters 16/24/32                                 |

## Typography

System font stack (no web-font download, no CSP font origin) with Noto families for Telugu, Tamil, Kannada,
Malayalam, Devanagari, Gujarati and Bengali. Sanskrit/regional terms keep their names and get an "What does this mean?"
explanation from the backend glossary.

## Voice

Prefer: _Good Time Now · Next Caution Period · Find a Good Time · Favorable Day · Times to Consider · Use Caution ·
Traditionally Avoided · What does this mean? · View Full Panchang_. Never: "Bad time", "Evil time".

## Components (Phase 1)

Button (primary / secondary / ghost, loading), LoadingState + Skeleton, EmptyState, ErrorState, OfflineBanner,
SkipLink, RouteAnnouncer; mobile Screen, AppText, ComingSoon. Feature components (PanchangCard, PeriodList,
DayTimeline, CalendarGrid, InfoSheet, LocationSelector…) are added with their features.
