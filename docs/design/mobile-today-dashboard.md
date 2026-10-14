# Mobile Today dashboard

The authenticated Today dashboard follows the supplied mobile mockup on web windows narrower than 1024 CSS pixels and in the native app. Mobile web pages share the fixed brand header and bottom navigation. Desktop web keeps its existing component tree and layout, with the timeline subtitle removed as requested.

Mobile web uses a fixed brand header with location and tradition selectors. The Today sunrise banner is removed; the date and wrapping Paksha, Tithi and location text appear above the day summary. The screen retains paired next-good-time and caution cards, Find a Good Time, timeline, auspicious periods, Panchang, avoid periods and rating explanations. Bottom Profile opens the existing identity, Profile, Settings and Log out menu. Mobile web footers retain only the decision notice; desktop keeps the full footer. Native retains its existing sunrise header.

## Data and behavior

- Identity comes from the existing userinfo query; full identity remains available in the account menu and Profile.
- The existing selected location and tradition providers continue to apply saved defaults and temporary choices. The header location opens the existing chooser.
- Day ratings, factors, Panchang limbs, transitions, and intervals come from the existing API-backed dashboard model. No API contracts or astrology calculations changed.
- The General good-time evaluation still controls the recommended-time card. An API error shows an unavailable state rather than inventing a recommendation.
- Timeline positions use the shared sunrise-to-next-sunrise model, including midnight and daylight-saving boundaries. Favorable, conflicting, and caution intervals occupy separate lanes. Expanding the timeline provides the original period details.
- Period previews order active and upcoming periods before completed periods, without changing the periods or conflicts. Conflict explanations remain visible even when details are collapsed. See all restores the complete list.
- The two-limb Panchang preview expands through either a row or See all to all original limbs and transition details inside the same card on mobile web. Avoid periods and rating factors remain available through disclosures.
- Signed-out visitors continue to see the public landing page with no application API requests.

## Verification approach

Browser coverage checks widths 320, 375, 430, 600, and 884 CSS pixels, equal-height summary cards, section order, overflow, WCAG accessibility, complete details, and Profile navigation. The desktop screenshot is compared against the pre-change reference. Visual references use Windows Chromium because font rasterization differs by operating system; structural and accessibility checks run on every supported test platform.

Native component tests cover API identity and date, Panchang expansion, timeline details, retained conflicts, and the authenticated Profile tab. Native tests use at most two workers, a 15-second test deadline, and a five-second asynchronous UI deadline so routing and debounced searches can settle on slower CI machines. Android and iOS bundling is checked separately from physical-device installation. Device installation and store release remain separate deployment steps.

The existing dashboard photo and design tokens are reused. Hero text/overlay tokens support readable header text in both themes. The native Expo Router root is explicitly `./app` so the `src/app` provider/configuration folder is not mistaken for route files.
