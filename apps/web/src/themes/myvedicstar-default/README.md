# MyPanchang Faithful Theme Kit

This kit was rebuilt from the two approved UI mockups supplied in the conversation.

## Included

- `home.html` — public landing page
- `login.html` — login flow
- `dashboard.html` — authenticated Today dashboard
- `calendar.html` — responsive month calendar + selected-day panel
- `good-time.html` — activity selection
- `full-panchang.html` — progressive-disclosure full Panchang
- `css/theme.css` — semantic theme + responsive rules
- `assets/icons/*.svg` — self-contained local SVG icons
- `assets/images/*` — local reference-derived hero/sunrise/lotus assets from the supplied mockups
- `js/app.js` — lightweight preview interactions

## Visual system

The approved mockups use a warm ivory/white foundation, deep navy typography, restrained bronze/gold actions, green favorable states, coral/red caution states, blue/teal informational states, and orange/pink festival accents. The public page uses photographic temple/sunrise imagery while the dashboard is denser and more functional.

## Preview

Open `home.html` directly in a browser. No CDN or external icon library is required.

## React / React Native

Treat `:root` semantic values in `css/theme.css` as the design-token source. Port these to a TypeScript token package and consume them from both web and native adapters. Do not attempt to reuse DOM CSS directly in React Native.

## Important

Displayed Panchang values are mock data for visual preview only. Production UI must use authoritative backend API results.
