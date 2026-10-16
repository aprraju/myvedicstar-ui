import { createRequire } from 'node:module';

import type {
  BestGoodTimesResponse,
  DaySummariesResponse,
  FestivalsResponse,
  GoodTimeExplanationResponse,
  GoodTimesResponse,
  MuhurtaActivitiesResponse,
  PanchangResponse,
  ResolvedLocation,
  TraditionsResponse,
  UserInfo,
} from '@myvedicstar/contracts';
import { expect, type Page, test as base } from '@playwright/test';

import { buildPanchangMonth } from '../../../packages/testing/src/month';

// Playwright loads specs as native ESM, where JSON needs import attributes; read the shared fixtures with require.
const require = createRequire(import.meta.url);
const fixture = <T>(name: string): T => require(`../../../packages/testing/src/fixtures/${name}.json`) as T;
const fixtures = {
  austinDay: fixture<PanchangResponse>('panchang-austin-telugu-2026-09-29'),
  hyderabadDay: fixture<PanchangResponse>('panchang-hyderabad-all-2026-09-29'),
  austin: fixture<ResolvedLocation>('location-austin'),
  hyderabad: fixture<ResolvedLocation>('location-hyderabad-coordinates'),
  notFound: fixture<object>('problem-place-not-found'),
  traditions: fixture<TraditionsResponse>('traditions'),
  festivals: fixture<FestivalsResponse>('festivals-austin-telugu-2026-10-01'),
  userInfo: fixture<UserInfo>('user-info'),
  activities: fixture<MuhurtaActivitiesResponse>('muhurta-activities'),
  austinGoodTimes: fixture<GoodTimesResponse>('muhurta-good-times-austin-general-2026-09-29'),
  hyderabadGoodTimes: fixture<GoodTimesResponse>('muhurta-good-times-hyderabad-general-2026-09-29'),
  austinBusiness: fixture<GoodTimesResponse>('muhurta-good-times-austin-business-2026-10-01'),
  explanation: fixture<GoodTimeExplanationResponse>('muhurta-explanation-austin-general-2026-10-20'),
  best: fixture<BestGoodTimesResponse>('muhurta-good-times-best-austin-business-2026-10-02'),
  monthBusiness: fixture<DaySummariesResponse>('muhurta-day-summaries-austin-business-2026-10'),
};

export function panchangMonthFixture(year: number, month: number): PanchangResponse {
  return buildPanchangMonth(fixtures.austinDay, year, month);
}

/** Must match public/config.json (the local runtime config shipped in the preview build). */
const API_ORIGIN = 'http://localhost:5275';

/** 10:00 in Austin on the fixture date: inside Durmuhurtham, before the first good window. */
export const FIXED_NOW = new Date('2026-09-29T10:00:00-05:00');

const isHyderabad = (url: URL) =>
  url.searchParams.get('latitude')?.startsWith('17.') ||
  /hyderabad/i.test(url.searchParams.get('place') ?? '');

/**
 * Extends Playwright's `page` so every test:
 * - runs with runtime config that enables mock sign-in (config.json is intercepted; the build is unchanged),
 * - mocks the backend with captured fixtures (no live APIs) and records API requests,
 * - fails if the browser reports any Content-Security-Policy violation or uncaught error.
 */
export const test = base.extend<{ violations: string[]; apiRequests: URL[] }>({
  // eslint-disable-next-line no-empty-pattern -- Playwright fixtures must destructure their dependencies.
  apiRequests: async ({}, use) => {
    await use([]);
  },
  violations: [
    async ({ page, apiRequests }, use) => {
      const violations: string[] = [];
      page.on('console', (message) => {
        if (message.type() === 'error' && /Content Security Policy|Refused to/i.test(message.text())) {
          violations.push(message.text());
        }
      });
      page.on('pageerror', (error) => violations.push(`Uncaught: ${error.message}`));
      // A blocked `eval` / `new Function` that the page catches never reaches the console (Chrome lists it only under
      // DevTools → Issues), so listen for the CSP violation event itself.
      await page.exposeFunction('__reportCspViolation', (violation: string) => violations.push(violation));
      await page.addInitScript(() => {
        document.addEventListener('securitypolicyviolation', (event) => {
          const report = (window as unknown as { __reportCspViolation: (violation: string) => void })
            .__reportCspViolation;
          void report(
            `CSP ${event.effectiveDirective} blocked ${event.blockedURI} at ${event.sourceFile}:${event.lineNumber}`,
          );
        });
      });

      await page.route('**/config.json', async (route) => {
        const response = await route.fetch();
        const config = (await response.json()) as Record<string, unknown>;
        await route.fulfill({
          response,
          json: {
            ...config,
            environment: 'test',
            auth: { mode: 'mock' },
            locationSearch: { enabled: false },
          },
        });
      });
      await page.route(`${API_ORIGIN}/api/v1/**`, (route) => {
        const url = new URL(route.request().url());
        apiRequests.push(url);
        if (!route.request().headers().authorization?.startsWith('Bearer '))
          return route.fulfill({ status: 401, json: { title: 'Unauthorized' } });
        if (url.pathname.endsWith('/traditions')) return route.fulfill({ json: fixtures.traditions });
        if (url.pathname.endsWith('/festivals/upcoming')) return route.fulfill({ json: fixtures.festivals });
        if (url.pathname.endsWith('/auth/login')) return route.fulfill({ json: fixtures.userInfo });
        if (url.pathname.endsWith('/settings'))
          return route.fulfill({
            json: { defaultTradition: null, defaultLocationId: null, defaultLocation: null, revision: 0 },
          });
        if (url.pathname.endsWith('/settings/locations')) return route.fulfill({ json: [] });
        if (url.pathname.endsWith('/muhurta/nakshatras'))
          return route.fulfill({
            json: {
              language: 'en',
              nakshatras: [
                { key: 'Ashwini', name: 'Ashwini', order: 1 },
                { key: 'Bharani', name: 'Bharani', order: 2 },
              ],
            },
          });
        if (url.pathname.endsWith('/muhurta/activities')) return route.fulfill({ json: fixtures.activities });
        if (url.pathname.endsWith('/muhurta/good-times/explanation')) {
          return route.fulfill({ json: fixtures.explanation });
        }
        if (url.pathname.endsWith('/muhurta/good-times/best')) return route.fulfill({ json: fixtures.best });
        if (url.pathname.endsWith('/muhurta/day-summaries'))
          return route.fulfill({ json: fixtures.monthBusiness });
        if (url.pathname.endsWith('/muhurta/good-times')) {
          if (url.searchParams.get('activity') === 'business')
            return route.fulfill({ json: fixtures.austinBusiness });
          return route.fulfill({
            json: isHyderabad(url) ? fixtures.hyderabadGoodTimes : fixtures.austinGoodTimes,
          });
        }
        if (url.pathname.endsWith('/contact')) return route.fulfill({ status: 202, body: '' });
        if (url.pathname.endsWith('/locations/resolve')) {
          if (/nowhere/i.test(url.searchParams.get('place') ?? '')) {
            return route.fulfill({ status: 400, json: fixtures.notFound });
          }
          return route.fulfill({ json: isHyderabad(url) ? fixtures.hyderabad : fixtures.austin });
        }
        const month = /\/panchang\/month\/(\d{4})\/(\d{1,2})$/.exec(url.pathname);
        if (month) {
          return route.fulfill({
            json: buildPanchangMonth(fixtures.austinDay, Number(month[1]), Number(month[2])),
          });
        }
        return route.fulfill({ json: isHyderabad(url) ? fixtures.hyderabadDay : fixtures.austinDay });
      });
      await page.clock.install({ time: FIXED_NOW });

      await use(violations);
      expect(violations, 'CSP violations or uncaught errors').toEqual([]);
    },
    { auto: true },
  ],
});

/** Starts as a returning visitor who already chose Austin (no geolocation prompt). */
export async function withSavedLocation(page: Page) {
  await page.addInitScript(
    (location) => window.localStorage.setItem('mvs.location.selected', JSON.stringify(location)),
    {
      id: '30.27,-97.74',
      label: 'Austin, Texas',
      fullName: 'Austin, Texas, United States',
      latitude: 30.27,
      longitude: -97.74,
      timeZone: 'America/Chicago',
      countryCode: 'US',
      source: 'search',
    },
  );
}

export { expect };
