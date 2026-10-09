# Responsive, tablet and foldable design

Layouts respond to the **available window**, never to device names. The same rules apply to phones, tablets,
foldables (folded and unfolded), split-screen, desktop browsers and resized windows.

## Window size classes

Defined once in `packages/design-tokens/src/window-class.ts` (web: `useWindowClass`, CSS media/container queries;
mobile: `useWindowClass` from `useWindowDimensions`).

| Class      | Width     | Typical                                                    | Layout                                   |
| ---------- | --------- | ---------------------------------------------------------- | ---------------------------------------- |
| compact    | < 600     | phones, folded outer screens (~344–412), narrow split view | one column, bottom tabs (mobile)         |
| medium     | 600–839   | small tablets portrait, unfolded inner portrait            | one column, wider cards, larger gutters  |
| expanded   | 840–1199  | tablets landscape, unfolded inner landscape (~884)         | two panes; side navigation rail (mobile) |
| large      | 1200–1599 | laptops, desktops                                          | two/three panes, header navigation       |
| extraLarge | ≥ 1600    | wide desktops                                              | centred content, max width 1200          |

Rules:

- Fluid between breakpoints: `clamp()` type, flex-wrap and grid, `min()` widths, logical properties.
- Content max width (`--content-max-width`), readable text width (`--readable-max-width: 70ch`).
- Gutters grow with width (16 → 24 → 32 px) and respect safe-area insets (`env(safe-area-inset-*)` on web,
  `SafeAreaView` on mobile).
- Strings may be 30–50 % longer in Telugu, Tamil, Malayalam, Kannada: no fixed-width text containers, wrap instead of
  truncate for primary content.
- Tablets get real two-pane layouts (Calendar | Day details, Summary | Favorable/Caution, Activity | Results), not
  stretched phone cards.

## Foldables

| Scenario                                       | Behaviour                                                                                                                                                                                                                                                                                                                      |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Folded outer display (narrow, e.g. 344 dp)     | compact; bottom tabs; single column; E2E-checked at 344 px for overflow                                                                                                                                                                                                                                                        |
| Unfolded inner display portrait (~ 673–720 dp) | medium; single column with larger gutters                                                                                                                                                                                                                                                                                      |
| Unfolded landscape (~ 884+ dp)                 | expanded; side rail; two-pane features                                                                                                                                                                                                                                                                                         |
| Fold/unfold at runtime                         | `useWindowDimensions` / `resize` update the class; state is kept (no remount of feature state)                                                                                                                                                                                                                                 |
| Split-screen / multi-window                    | treated as whatever width the window has                                                                                                                                                                                                                                                                                       |
| Hinge                                          | Critical controls are not centred across the middle of expanded two-pane layouts; panes split at the fold. Exact hinge geometry (Jetpack WindowManager; web Viewport Segments API `horizontal-viewport-segments`) will be added when two-pane features ship (Phase 3–4) and validated on Android foldable emulators (Phase 6). |

## Public experience layouts (Phase 2)

| Element                             | compact (< 600)                                             | medium (600–839)                                              | expanded (840–1199)                                    | large (≥ 1200)                                     |
| ----------------------------------- | ----------------------------------------------------------- | ------------------------------------------------------------- | ------------------------------------------------------ | -------------------------------------------------- |
| Web header                          | brand · Login · menu; location + tradition row; nav in menu | same                                                          | brand · nav · Login/Register; location + tradition row | one row: brand · nav · location · tradition · auth |
| Home hero                           | text, then card                                             | text, then card                                               | text │ card (two columns)                              | text │ card                                        |
| Summary facts (good time / caution) | stacked                                                     | side by side when the card is ≥ 32 rem wide (container query) | side by side                                           | side by side                                       |
| Feature cards                       | 1 column                                                    | auto-fill, min 16 rem                                         | auto-fill                                              | auto-fill                                          |
| Location picker                     | bottom sheet                                                | centered dialog                                               | centered dialog                                        | centered dialog                                    |
| Mobile Today                        | single column                                               | single column                                                 | hero │ card (two panes, e.g. unfolded foldable)        | two panes                                          |

## Verified

Playwright checks **no horizontal overflow with the Panchang card loaded** at 320, 344, 360, 375, 390, 412, 430, 480,
600, 768, 820, 884, 1024, 1280, 1440 and 1920 px, in desktop and mobile (Pixel 7 emulation) projects; Login at 320 px
(the 200 %-zoom equivalent of 640 px); the header menu at 390 px and the one-row header at 1280 px. Mobile Jest tests
render navigation at 390 dp and 884 dp.

## Visual regression (Phase 6)

Playwright screenshot tests for 390 phone, 344 narrow foldable, 768 tablet portrait, 1024 tablet landscape, 884
foldable expanded, 1280 desktop, 1920 wide desktop — reject clipped text, overflow, overlapping overlays or broken grids.
