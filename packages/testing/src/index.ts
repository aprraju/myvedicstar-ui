import type {
  BestGoodTimesResponse,
  DaySummariesResponse,
  FestivalsResponse,
  GlossaryResponse,
  GoodTimeExplanationResponse,
  GoodTimesResponse,
  MuhurtaActivitiesResponse,
  PanchangResponse,
  ProblemDetails,
  ResolvedLocation,
  TimePeriod,
  TraditionsResponse,
  UserInfo,
} from '@myvedicstar/contracts';

import festivalsAustinTelugu from './fixtures/festivals-austin-telugu-2026-10-01.json';
import glossary from './fixtures/glossary.json';
import locationAustin from './fixtures/location-austin.json';
import locationHyderabadCoordinates from './fixtures/location-hyderabad-coordinates.json';
import muhurtaActivities from './fixtures/muhurta-activities.json';
import muhurtaDaySummariesAustin from './fixtures/muhurta-day-summaries-austin-2026-10.json';
import muhurtaDaySummariesAustinBusiness from './fixtures/muhurta-day-summaries-austin-business-2026-10.json';
import muhurtaExplanationAustinGeneral from './fixtures/muhurta-explanation-austin-general-2026-10-20.json';
import muhurtaGoodTimesAustinBusiness from './fixtures/muhurta-good-times-austin-business-2026-10-01.json';
import muhurtaGoodTimesAustinFavorableDay from './fixtures/muhurta-good-times-austin-general-2026-04-28.json';
import muhurtaGoodTimesAustinToday from './fixtures/muhurta-good-times-austin-general-2026-09-29.json';
import muhurtaGoodTimesAustinGeneral from './fixtures/muhurta-good-times-austin-general-2026-10-20.json';
import muhurtaGoodTimesAustinOther from './fixtures/muhurta-good-times-austin-other-bakery-2026-10-01.json';
import muhurtaBestAustinBusiness from './fixtures/muhurta-good-times-best-austin-business-2026-10-02.json';
import muhurtaBestAustinOther from './fixtures/muhurta-good-times-best-austin-other-bakery-2026-10-02.json';
import muhurtaGoodTimesHyderabadExcluded from './fixtures/muhurta-good-times-hyderabad-business-excluded-2026-10-02.json';
import muhurtaGoodTimesHyderabadToday from './fixtures/muhurta-good-times-hyderabad-general-2026-09-29.json';
import panchangAustinAmavasya from './fixtures/panchang-austin-amavasya-2026-12-08.json';
import panchangAustinAvoid from './fixtures/panchang-austin-avoid-2026-07-13.json';
import panchangAustinCaution from './fixtures/panchang-austin-caution-2026-10-03.json';
import panchangAustinDstEnd from './fixtures/panchang-austin-dst-end-2026-11-01.json';
import panchangAustinFavorable from './fixtures/panchang-austin-favorable-2026-04-28.json';
import panchangAustinHighlyFavorable from './fixtures/panchang-austin-highly-favorable-2026-01-23.json';
import panchangAustinPurnima from './fixtures/panchang-austin-purnima-2026-09-26.json';
import panchangAustinTelugu from './fixtures/panchang-austin-telugu-2026-09-29.json';
import panchangHyderabadAll from './fixtures/panchang-hyderabad-all-2026-09-29.json';
import problemPlaceNotFound from './fixtures/problem-place-not-found.json';
import problemValidation from './fixtures/problem-validation.json';
import traditions from './fixtures/traditions.json';
import userInfo from './fixtures/user-info.json';

/**
 * Responses captured from the real MyVedicDay API (see README "Refreshing fixtures").
 * Tests must never call live APIs; they use these fixtures (directly or through MSW handlers).
 */
export const fixtures = {
  panchang: {
    /** Austin, Texas, Telugu tradition — a mixed day in America/Chicago (CDT). */
    austinTelugu: panchangAustinTelugu as PanchangResponse,
    /** Hyderabad by coordinates, all traditions — includes Choghadiya, Asia/Kolkata. */
    hyderabadAll: panchangHyderabadAll as PanchangResponse,
    /** Austin on 2026-11-01, the day US daylight saving time ends (CDT → CST). */
    austinDstEnd: panchangAustinDstEnd as PanchangResponse,
    /** Austin, Telugu — rating HighlyFavorable. */
    austinHighlyFavorable: panchangAustinHighlyFavorable as PanchangResponse,
    /** Austin, Telugu — rating Favorable. */
    austinFavorable: panchangAustinFavorable as PanchangResponse,
    /** Austin, Telugu — rating Caution. */
    austinCaution: panchangAustinCaution as PanchangResponse,
    /** Austin, Telugu — rating Avoid, with three Tithi transitions (Krishna Chaturdashi → Amavasya → Shukla Pratipada). */
    austinAvoid: panchangAustinAvoid as PanchangResponse,
    /** Austin, Telugu — Purnima at sunrise. */
    austinPurnima: panchangAustinPurnima as PanchangResponse,
    /** Austin, Telugu — Amavasya at sunrise. */
    austinAmavasya: panchangAustinAmavasya as PanchangResponse,
  },
  location: {
    austin: locationAustin as ResolvedLocation,
    hyderabadCoordinates: locationHyderabadCoordinates as ResolvedLocation,
  },
  traditions: traditions as TraditionsResponse,
  /** Upcoming festivals, Austin, Telugu, 60 days from 2026-10-01 (`GET /festivals/upcoming`). */
  festivals: festivalsAustinTelugu as FestivalsResponse,
  /** Find a Good Time (`/muhurta/*`), Telugu tradition, captured from the real API. */
  muhurta: {
    activities: muhurtaActivities as MuhurtaActivitiesResponse,
    goodTimes: {
      /**
       * Austin, General, 2026-10-20: three Good Times (best 07:36–09:52); Abhijit Muhurta overlapping Gulika Kalam is
       * Mixed, and overlapping Varjyam / Dur Muhurtam is Caution — favorable periods the backend did not recommend.
       */
      austinGeneral: muhurtaGoodTimesAustinGeneral as GoodTimesResponse,
      /** Austin, Business, 2026-10-01: one Good Time; the afternoon (Amrit Kalam over Rahu Kalam) is Avoid. */
      austinBusiness: muhurtaGoodTimesAustinBusiness as GoodTimesResponse,
      /** Austin, Other "Opening a bakery shop" → evaluated as Business, with a notice. */
      austinOther: muhurtaGoodTimesAustinOther as GoodTimesResponse,
      /** Hyderabad, Business, 2026-10-02: the day is excluded for business; no Good Time (nothing promoted). */
      hyderabadExcluded: muhurtaGoodTimesHyderabadExcluded as GoodTimesResponse,
      /** Austin, Telugu, General, 2026-09-29 — the date of `panchang.austinTelugu`: Mixed, no Good Time. */
      austinToday: muhurtaGoodTimesAustinToday as GoodTimesResponse,
      /** Hyderabad, all traditions, General, 2026-09-29 — the date of `panchang.hyderabadAll`: Caution, no Good Time. */
      hyderabadToday: muhurtaGoodTimesHyderabadToday as GoodTimesResponse,
      /** Austin, Telugu, General, 2026-04-28 — the date of `panchang.austinFavorable`: six Good Times from 06:50. */
      austinFavorableDay: muhurtaGoodTimesAustinFavorableDay as GoodTimesResponse,
    },
    /** Template explanation for `goodTimes.austinGeneral` (AI disabled). */
    explanation: muhurtaExplanationAustinGeneral as GoodTimeExplanationResponse,
    /** Austin, General, October 2026: one summary per day (calendar tiles). */
    daySummaries: muhurtaDaySummariesAustin as DaySummariesResponse,
    /** Austin, Business, October 2026 (Find a Good Time month view): e.g. 1st Highly Favorable, 3rd Mixed, 5th Avoid. */
    daySummariesBusiness: muhurtaDaySummariesAustinBusiness as DaySummariesResponse,
    /** Next best Good Times (`/muhurta/good-times/best`), searched 2026-10-02 at 09:37 in Austin, 30 days. */
    best: {
      /** Business: Oct 2 14:30–16:17, Oct 4 11:27–12:55, Oct 12 10:24–11:43 — all Highly Favorable. */
      austinBusiness: muhurtaBestAustinBusiness as BestGoodTimesResponse,
      /** Other "Opening a bakery shop" → Business, with the "Evaluated as Business." notice. */
      austinOther: muhurtaBestAustinOther as BestGoodTimesResponse,
    },
  },
  /** Sample `POST /auth/login` user info (synthetic person). */
  userInfo: userInfo as UserInfo,
  glossary: glossary as GlossaryResponse,
  problem: {
    validation: problemValidation as ProblemDetails,
    /** 400 from /locations/resolve for an unknown place (e.g. a ZIP code, which the API does not support). */
    placeNotFound: problemPlaceNotFound as ProblemDetails,
  },
} as const;

/** Deep-copies a fixture so tests can mutate it without leaking state into other tests. */
export function cloneFixture<T>(fixture: T): T {
  return structuredClone(fixture);
}

/**
 * Builds a Panchang response variant, e.g. a day with no auspicious periods, without hand-writing JSON.
 * The first day is passed to `mutateDay`.
 */
export function buildPanchangResponse(
  base: PanchangResponse = fixtures.panchang.austinTelugu,
  mutateDay?: (day: PanchangResponse['days'][number]) => void,
): PanchangResponse {
  const response = cloneFixture(base);
  const [first] = response.days;
  if (first && mutateDay) {
    mutateDay(first);
  }
  return response;
}

/** A Panchang day that returned no optional periods at all — a valid, non-error state. */
export function buildPanchangWithoutOptionalPeriods(): PanchangResponse {
  return buildPanchangResponse(undefined, (day) => {
    const none: TimePeriod[] = [];
    day.auspiciousPeriods = none;
    day.guidance.bestWindows = [];
    day.guidance.favorableWindows = [];
    day.guidance.spiritualWindows = [];
    delete day.choghadiya;
  });
}

export { buildPanchangMonth } from './month';
