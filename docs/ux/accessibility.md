# Accessibility

Target: **WCAG 2.2 AA** on web; VoiceOver/TalkBack, Dynamic Type and large touch targets on mobile.

## Foundation (Phase 1)

| Requirement               | Implementation                                                                                                                                   |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Semantic structure        | `header`/`nav`/`main`/`footer` landmarks; one `h1` per page; heading ids for `aria-labelledby`                                                   |
| Skip navigation           | "Skip to main content" link, first tab stop, targets `<main tabindex="-1">` (E2E verified)                                                       |
| SPA navigation            | Focus moves to `<main>` and a polite live region announces "<Page> page loaded"; `document.title` per route                                      |
| Focus visibility          | 3 px `--color-focus` outline with offset (≥ 3:1 contrast, token-tested)                                                                          |
| Contrast                  | Every text/background token pair ≥ 4.5:1, focus/strong borders ≥ 3:1 in light and dark (`tokens.test.ts`); axe `wcag2aa` in E2E for both schemes |
| Status not by color alone | Status components always pair color with an icon and text ("✓ Favorable", "Use caution") — enforced in component design (Phase 2+)               |
| Errors                    | `role="alert"` with friendly text and support reference; loading `role="status"`; offline banner `role="status"`                                 |
| Busy buttons              | `aria-busy`, `aria-disabled`, visually hidden "Loading…"                                                                                         |
| Target size               | Interactive elements ≥ 44 × 44 px (`--touch-target-minimum`)                                                                                     |
| Reduced motion            | `prefers-reduced-motion` zeroes durations and stops shimmer                                                                                      |
| Zoom / reflow             | No horizontal scroll at 320 CSS px (E2E); `text-size-adjust` respected; zoom never disabled in the viewport meta                                 |
| Language                  | `<html lang dir>` set from the active UI language                                                                                                |
| External links            | "(opens in a new tab)" announced                                                                                                                 |
| Mobile                    | `accessibilityRole="header"` titles, tab `accessibilityLabel`s, `AppText` scales with system font size (cap ×2)                                  |

## Public experience (Phase 2)

| Requirement                   | Implementation                                                                                                                                                                                                      |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Day status not by color alone | Tone badge = icon (✓ / ⓘ / ⚠) + headline from the backend's General status ("Favorable day") + color; facts labelled "Good time now", "Use caution now"                                                             |
| Dialogs                       | Native `<dialog>` (modal, Esc closes, background inert, labelled by its title, described by the privacy note); focus returns to the opener; bottom sheet on compact windows                                         |
| Forms                         | Visible labels, hints via `aria-describedby`, `aria-invalid` + `role="alert"` messages from localization keys; `noValidate` so messages are consistent across browsers                                              |
| Tradition                     | Native labelled `<select>` (web); radio group in a sheet (mobile)                                                                                                                                                   |
| Header menu                   | Disclosure button with `aria-expanded`/`aria-controls`; closes on Esc and navigation                                                                                                                                |
| Loading                       | Skeleton inside `role="status"` with a spoken label ("Finding your location…", "Loading…"); `aria-busy` on the card while fetching                                                                                  |
| Mobile                        | Accessible notices (`accessible` + `alert` role), facts read as one sentence ("Next good time. 12:06 PM – 1:02 PM"); with no Good Time, the backend's message is read instead, 44 pt targets, font scaling up to ×2 |

## Automated checks

- Component tests: axe-core on rendered pages/components (`src/test/axe.ts`; color contrast is checked in the browser).
- E2E: `@axe-core/playwright` with `wcag2a`, `wcag2aa`, `wcag21aa`, `wcag22aa` tags, light and dark.

## Manual checks (each phase; full audit in Phase 6)

Keyboard-only walkthrough, NVDA + Firefox/Chrome, VoiceOver + Safari (macOS/iOS), TalkBack (Android), 200 % and 400 %
zoom, Windows high-contrast mode, dialog focus trapping and return focus (when dialogs/bottom sheets ship), Dynamic Type
at the largest sizes.

## Patterns for upcoming components

- Info popovers/bottom sheets: accessible dialog (focus trap, `Esc`, return focus, labelled title) via a headless
  primitive; no hover-only content.
- Timeline: an accessible list/table alternative to the visual bar; each period read as "Rahu Kalam, use caution,
  3:10 PM to 4:39 PM".
- Calendar: grid semantics with arrow-key navigation; markers (Amavasya, Purnima, Ekadashi) as text/icons, not color.
