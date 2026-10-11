import { fixtures } from '@myvedicstar/testing';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { axeViolations } from '../../test/axe';
import { atInstant, austin, storeSelectedLocation } from '../../test/location-fixtures';
import { apiRequests, scenarios } from '../../test/msw/handlers';
import { server } from '../../test/msw/server';
import { fakeGeolocation, renderWithProviders } from '../../test/render';
import { DaySummaryCard } from './DaySummaryCard';

const card = () => screen.getByRole('region', { name: "Today's summary" });

describe('DaySummaryCard', () => {
  it('uses only Today data for the public home tile', async () => {
    await atInstant('2026-09-29T10:00:00-05:00');
    const response = structuredClone(fixtures.panchang.austinTelugu);
    response.days[0]!.goodTime = {
      date: '2026-09-29',
      dateDisplay: 'September 29',
      status: { status: 'Favorable', name: 'Favorable', icon: null },
      goodTimeCount: 1,
      bestGoodTime: {
        start: '2026-09-29T11:00:00-05:00',
        end: '2026-09-29T12:00:00-05:00',
        startDisplay: '11:00 AM',
        endDisplay: '12:00 PM',
        status: { status: 'Favorable', name: 'Favorable', icon: null },
      },
      noGoodTimeReason: null,
    };
    server.use(scenarios.json('/panchang/today', response));
    storeSelectedLocation();
    renderWithProviders(<DaySummaryCard todayOnly />);
    expect(await screen.findByText('Favorable day')).toBeInTheDocument();
    expect(card()).toHaveTextContent(/11:00\sAM.*12:00\sPM/);
    expect(apiRequests.some((u) => u.pathname.includes('/muhurta/'))).toBe(false);
    expect(apiRequests.some((u) => u.pathname.includes('/festivals/'))).toBe(false);
  });

  it('uses the Today no-good-time reason without requesting an evaluation', async () => {
    await atInstant('2026-09-29T10:00:00-05:00');
    const response = structuredClone(fixtures.panchang.austinTelugu);
    response.days[0]!.goodTime = {
      ...response.days[0]!.goodTime!,
      bestGoodTime: null,
      goodTimeCount: 0,
      noGoodTimeReason: 'No good time is available today.',
    };
    server.use(scenarios.json('/panchang/today', response));
    storeSelectedLocation();
    renderWithProviders(<DaySummaryCard todayOnly />);
    expect(await screen.findByText('No good time is available today.')).toBeInTheDocument();
    expect(apiRequests.some((u) => u.pathname.includes('/muhurta/'))).toBe(false);
  });

  it('shows a readable fallback for a Today no-good-time reason code', async () => {
    await atInstant('2026-09-29T10:00:00-05:00');
    const response = structuredClone(fixtures.panchang.austinTelugu);
    response.days[0]!.goodTime = {
      ...response.days[0]!.goodTime!,
      bestGoodTime: null,
      goodTimeCount: 0,
      noGoodTimeReason: 'NO_QUALIFYING_PERIOD',
    };
    server.use(scenarios.json('/panchang/today', response));
    storeSelectedLocation();
    renderWithProviders(<DaySummaryCard todayOnly />);
    expect(await screen.findByText('No more recommended times today')).toBeInTheDocument();
    expect(card()).not.toHaveTextContent('NO_QUALIFYING_PERIOD');
  });

  it('answers how today is, whether now is good and the next caution period', async () => {
    await atInstant('2026-09-29T10:00:00-05:00');
    storeSelectedLocation();
    const { container } = renderWithProviders(<DaySummaryCard />);

    // Headline from the backend's General day status (Mixed); the description is the day-factor summary.
    expect(await screen.findByText('Mixed day')).toBeInTheDocument();
    const region = card();
    expect(region).toHaveTextContent('Tuesday, September 29');
    expect(region).toHaveTextContent('Krishna Paksha');
    expect(region).toHaveTextContent('Krishna Chaturthi');
    expect(region).toHaveTextContent("Today's Panchang factors are mixed");
    // The General evaluation of this day has no Good Time: the backend's message, nothing promoted.
    expect(
      await screen.findByText(
        'No strongly favorable time was found for this activity today. Please choose another date.',
      ),
    ).toBeInTheDocument();
    expect(region).toHaveTextContent(/Use caution now\s*Durmuhurtham 9:46\sAM – 10:34\sAM/);
    expect(region).toHaveTextContent('Unfavorable Muhurta');
    expect(region).toHaveTextContent('All times shown in local time — Austin, Texas');
    expect(within(region).getByRole('link', { name: 'Find a Good Time' })).toHaveAttribute(
      'href',
      '/good-time',
    );
    const goodTimes = apiRequests.find((u) => u.pathname.endsWith('/muhurta/good-times'))!;
    expect(Object.fromEntries(goodTimes.searchParams)).toMatchObject({
      activity: 'general',
      tradition: 'all',
    });
    expect(goodTimes.searchParams.has('date')).toBe(false);
    expect(await axeViolations(container)).toEqual([]);
  });

  describe('Good Time from the backend evaluation (Austin, 2026-04-28: six Good Times from 6:50 AM)', () => {
    const favorableDay = () =>
      server.use(
        scenarios.json('/panchang/today', fixtures.panchang.austinFavorable),
        scenarios.json('/muhurta/good-times', fixtures.muhurta.goodTimes.austinFavorableDay),
      );

    it('shows the Good Time in progress', async () => {
      await atInstant('2026-04-28T07:00:00-05:00');
      favorableDay();
      storeSelectedLocation();
      renderWithProviders(<DaySummaryCard />);
      expect(await screen.findByText('Good time now')).toBeInTheDocument();
      expect(card()).toHaveTextContent(/until 8:23\sAM/);
    });

    it('shows the next Good Time between Good Times', async () => {
      await atInstant('2026-04-28T10:00:00-05:00');
      favorableDay();
      storeSelectedLocation();
      renderWithProviders(<DaySummaryCard />);
      expect(await screen.findByText('Next good time')).toBeInTheDocument();
      expect(card()).toHaveTextContent(/Next good time\s*12:06\sPM – 1:02\sPM/);
    });
  });

  it('marks periods that end after midnight', async () => {
    await atInstant('2026-09-29T20:00:00-05:00');
    storeSelectedLocation();
    renderWithProviders(<DaySummaryCard />);
    expect(
      await screen.findByText(
        'No strongly favorable time was found for this activity today. Please choose another date.',
      ),
    ).toBeInTheDocument();
    expect(card()).toHaveTextContent(/Durmuhurtham 12:08\sAM \(next day\) – 12:57\sAM \(next day\)/);
  });

  it.each([
    ['austinHighlyFavorable', 'Highly favorable day', 'highly-favorable'],
    ['austinCaution', 'Mixed day', 'mixed'],
    ['austinAvoid', 'Traditionally avoided for new beginnings', 'avoid'],
  ] as const)(
    'conveys the General status of %s with text and icon, not color alone',
    async (fixture, headline, tone) => {
      server.use(scenarios.json('/panchang/today', fixtures.panchang[fixture]));
      storeSelectedLocation();
      renderWithProviders(<DaySummaryCard />);
      const text = await screen.findByText(headline);
      const badge = text.closest('[data-status-tone]')!;
      expect(badge).toHaveAttribute('data-status-tone', tone);
      expect(badge.querySelector('svg')).not.toBeNull();
    },
  );

  it('never derives a Good Time from Panchang windows: only the backend evaluation decides', async () => {
    await atInstant('2026-09-29T10:00:00-05:00');
    // The day has a "best window" 11:51–13:20, but the General evaluation found no Good Time.
    storeSelectedLocation();
    renderWithProviders(<DaySummaryCard />);
    expect(
      await screen.findByText(
        'No strongly favorable time was found for this activity today. Please choose another date.',
      ),
    ).toBeInTheDocument();
    expect(card()).not.toHaveTextContent(/11:51\sAM/);
  });

  it('shows no Good Time while the evaluation is loading', async () => {
    await atInstant('2026-04-28T10:00:00-05:00');
    server.use(
      scenarios.json('/panchang/today', fixtures.panchang.austinFavorable),
      scenarios.slow('/muhurta/good-times', fixtures.muhurta.goodTimes.austinFavorableDay, 300),
    );
    storeSelectedLocation();
    renderWithProviders(<DaySummaryCard />);
    expect(await screen.findByText('Checking good times…')).toBeInTheDocument();
    expect(await screen.findByText(/12:06\sPM – 1:02\sPM/)).toBeInTheDocument();
  });

  it("shows the day's festivals and observances from the backend", async () => {
    await atInstant('2026-09-29T10:00:00-05:00');
    const sample = fixtures.festivals.festivals[0]!;
    server.use(
      scenarios.json('/festivals/upcoming', {
        ...fixtures.festivals,
        from: '2026-09-29',
        festivals: [
          { ...sample, key: 'Sample', name: 'Sample Festival', category: 'festival', date: '2026-09-29' },
        ],
      }),
    );
    storeSelectedLocation();
    renderWithProviders(<DaySummaryCard />);
    const list = await screen.findByRole('list', { name: 'Festivals & observances' });
    expect(list).toHaveTextContent('Sample Festival');
  });

  it('shows a skeleton while loading, then the content', async () => {
    server.use(scenarios.slow('/panchang/today', fixtures.panchang.austinTelugu, 200));
    storeSelectedLocation();
    renderWithProviders(<DaySummaryCard />);
    expect(within(card()).getByRole('status')).toHaveTextContent('Loading…');
    expect(await screen.findByText('Mixed day')).toBeInTheDocument();
  });

  it('shows a friendly error with retry', async () => {
    server.use(scenarios.serverError('/panchang/today'));
    storeSelectedLocation();
    renderWithProviders(<DaySummaryCard />);
    expect(await screen.findByText("We couldn't load today's Panchang.")).toBeInTheDocument();
    expect(screen.getByRole('alert')).not.toHaveTextContent('corr-500');

    server.resetHandlers();
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('Mixed day')).toBeInTheDocument();
  });

  it('asks for a location when none is known', async () => {
    renderWithProviders(<DaySummaryCard />, { geolocation: fakeGeolocation({ permission: 'unsupported' }) });
    expect(await screen.findByText('Choose a location to see today’s Panchang')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Use my current location' })).toBeInTheDocument();
    expect(apiRequests.filter((u) => u.pathname.includes('/panchang'))).toHaveLength(0);
  });

  it('requests Panchang for the selected location, tradition and language', async () => {
    storeSelectedLocation(austin);
    window.localStorage.setItem('mvs.tradition', '"telugu"');
    renderWithProviders(<DaySummaryCard />);
    await screen.findByText('Mixed day');
    const request = apiRequests.find((u) => u.pathname.endsWith('/panchang/today'))!;
    expect(Object.fromEntries(request.searchParams)).toEqual({
      latitude: '30.27',
      longitude: '-97.74',
      timeZone: 'America/Chicago',
      tradition: 'telugu',
      language: 'en',
    });
  });
});
