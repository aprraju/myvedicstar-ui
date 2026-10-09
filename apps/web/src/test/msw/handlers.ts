import { addDays } from '@myvedicstar/date-time';
import { buildPanchangMonth, fixtures } from '@myvedicstar/testing';
import { delay, http, HttpResponse } from 'msw';

export const TEST_API_BASE_URL = 'https://api.test.myvedicstar.example';
const api = (path: string) => `${TEST_API_BASE_URL}/api/v1${path}`;

/** Every request the mocked API received, so tests can assert location/tradition/language parameters. */
export const apiRequests: URL[] = [];

const isHyderabad = (url: URL) =>
  url.searchParams.get('latitude')?.startsWith('17.') ||
  /hyderabad/i.test(url.searchParams.get('place') ?? '');

/** Default happy-path handlers backed by responses captured from the real API. */
export const handlers = [
  http.get(api('/panchang/today'), ({ request }) => {
    const url = new URL(request.url);
    apiRequests.push(url);
    return HttpResponse.json(
      isHyderabad(url) ? fixtures.panchang.hyderabadAll : fixtures.panchang.austinTelugu,
    );
  }),
  http.get(api('/panchang/month/:year/:month'), ({ request, params }) => {
    apiRequests.push(new URL(request.url));
    return HttpResponse.json(
      buildPanchangMonth(fixtures.panchang.austinTelugu, Number(params.year), Number(params.month)),
    );
  }),
  http.get(api('/panchang/:date'), ({ request }) => {
    apiRequests.push(new URL(request.url));
    return HttpResponse.json(fixtures.panchang.austinTelugu);
  }),
  http.get(api('/locations/resolve'), ({ request }) => {
    const url = new URL(request.url);
    apiRequests.push(url);
    const place = url.searchParams.get('place');
    if (place && /nowhere/i.test(place)) {
      return HttpResponse.json(fixtures.problem.placeNotFound, {
        status: 400,
        headers: { 'Content-Type': 'application/problem+json' },
      });
    }
    return HttpResponse.json(
      isHyderabad(url) ? fixtures.location.hyderabadCoordinates : fixtures.location.austin,
    );
  }),
  http.get(api('/muhurta/activities'), ({ request }) => {
    apiRequests.push(new URL(request.url));
    return HttpResponse.json(fixtures.muhurta.activities);
  }),
  // Find a Good Time: Other → mapped to Business; Business → one Good Time (Austin) or an excluded day (Hyderabad);
  // General for today → the evaluation of the /panchang/today fixture's date; any other General request → 2026-10-20.
  http.get(api('/muhurta/good-times'), ({ request }) => {
    const url = new URL(request.url);
    apiRequests.push(url);
    const { goodTimes } = fixtures.muhurta;
    const activity = url.searchParams.get('activity') ?? 'general';
    if (activity === 'other') return HttpResponse.json(goodTimes.austinOther);
    if (activity === 'business')
      return HttpResponse.json(isHyderabad(url) ? goodTimes.hyderabadExcluded : goodTimes.austinBusiness);
    if (!url.searchParams.get('date'))
      return HttpResponse.json(isHyderabad(url) ? goodTimes.hyderabadToday : goodTimes.austinToday);
    return HttpResponse.json(goodTimes.austinGeneral);
  }),
  http.get(api('/muhurta/good-times/explanation'), ({ request }) => {
    apiRequests.push(new URL(request.url));
    return HttpResponse.json(fixtures.muhurta.explanation);
  }),
  // Day summaries: Business (or Other → Business) or General for October 2026; other months reuse October's statuses
  // re-dated, so month navigation has data.
  http.get(api('/muhurta/day-summaries'), ({ request }) => {
    const url = new URL(request.url);
    apiRequests.push(url);
    const activity = url.searchParams.get('activity') ?? 'general';
    const october =
      activity === 'business' || activity === 'other'
        ? fixtures.muhurta.daySummariesBusiness
        : fixtures.muhurta.daySummaries;
    const start = url.searchParams.get('start') ?? '2026-10-01';
    const days = Number(url.searchParams.get('days') ?? october.days.length);
    if (start === '2026-10-01' && days === october.days.length) return HttpResponse.json(october);
    return HttpResponse.json({
      ...october,
      days: Array.from({ length: days }, (_, i) => {
        const date = addDays(start, i);
        return { ...october.days[i % october.days.length]!, date, dateDisplay: date };
      }),
    });
  }),
  // Next best times: Other → mapped to Business (with its notice); anything else → the Business options.
  http.get(api('/muhurta/good-times/best'), ({ request }) => {
    const url = new URL(request.url);
    apiRequests.push(url);
    const { best } = fixtures.muhurta;
    return HttpResponse.json(
      url.searchParams.get('activity') === 'other' ? best.austinOther : best.austinBusiness,
    );
  }),
  http.get(api('/festivals/upcoming'), ({ request }) => {
    apiRequests.push(new URL(request.url));
    return HttpResponse.json(fixtures.festivals);
  }),
  http.post(api('/auth/userinfo'), ({ request }) => {
    apiRequests.push(new URL(request.url));
    if (!request.headers.get('Authorization')?.startsWith('Bearer ')) {
      return HttpResponse.json({ status: 401, title: 'Unauthorized' }, { status: 401 });
    }
    return HttpResponse.json(fixtures.userInfo);
  }),
  http.post(api('/contact'), ({ request }) => {
    apiRequests.push(new URL(request.url));
    return new HttpResponse(null, { status: 202 });
  }),
  http.get(api('/traditions'), ({ request }) => {
    apiRequests.push(new URL(request.url));
    return HttpResponse.json(fixtures.traditions);
  }),
];

/** Scenario handlers for error, slow and alternative states; use with `server.use(...)`. */
export const scenarios = {
  serverError: (path: string, method: 'get' | 'post' = 'get') =>
    http[method](api(path), () =>
      HttpResponse.json(
        { status: 500, title: 'An unexpected error occurred.', correlationId: 'corr-500' },
        { status: 500, headers: { 'Content-Type': 'application/problem+json' } },
      ),
    ),
  networkError: (path: string) => http.get(api(path), () => HttpResponse.error()),
  json: (path: string, body: Parameters<typeof HttpResponse.json>[0]) =>
    http.get(api(path), () => HttpResponse.json(body)),
  slow: (path: string, body: Parameters<typeof HttpResponse.json>[0], ms = 2000) =>
    http.get(api(path), async () => {
      await delay(ms);
      return HttpResponse.json(body);
    }),
};
