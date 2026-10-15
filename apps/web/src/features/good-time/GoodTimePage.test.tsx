import { todayIn } from '@myvedicstar/date-time';
import { fixtures } from '@myvedicstar/testing';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { createInMemoryAuthClient } from '../../shared/auth';
import { axeViolations } from '../../test/axe';
import { atInstant, storeSelectedLocation } from '../../test/location-fixtures';
import { apiRequests, scenarios } from '../../test/msw/handlers';
import { server } from '../../test/msw/server';
import { renderRoute } from '../../test/render';

const signedIn = () => createInMemoryAuthClient({ user: { id: 'u1' } });
const radios = () =>
  within(screen.getByRole('radiogroup', { name: 'What are you planning?' })).getAllByRole('radio');
const radio = (name: string) => screen.getByRole('radio', { name });
const goodTimeRequests = () => apiRequests.filter((url) => url.pathname.endsWith('/muhurta/good-times'));
const NO_GOOD_TIME =
  'No strongly favorable time was found for this activity today. Please choose another date.';

/** Fixtures: real API responses for Austin, Telugu tradition (see packages/testing). */
describe('Find a Good Time', () => {
  it('sends the selected birth star to each evaluation and omits it for None', async () => {
    storeSelectedLocation();
    const user = userEvent.setup();
    renderRoute('/good-time', { auth: signedIn() });
    const selector = await screen.findByRole('combobox', {
      name: 'Select your birth star to get more accurate results',
    });
    await waitFor(() => expect(selector).toBeEnabled());
    await screen.findByText(NO_GOOD_TIME);
    expect(goodTimeRequests().every((url) => !url.searchParams.has('nakshatra'))).toBe(true);
    await user.selectOptions(selector, 'Ashwini');
    for (const endpoint of ['good-times', 'good-times/explanation', 'day-summaries']) {
      await waitFor(() =>
        expect(
          apiRequests.some(
            (url) =>
              url.pathname.endsWith(`/muhurta/${endpoint}`) &&
              url.searchParams.get('nakshatra') === 'Ashwini',
          ),
        ).toBe(true),
      );
    }
    await user.click(screen.getByRole('radio', { name: 'Month' }));
    await waitFor(() =>
      expect(
        apiRequests.some(
          (url) =>
            url.pathname.endsWith('/muhurta/day-summaries') &&
            url.searchParams.get('nakshatra') === 'Ashwini',
        ),
      ).toBe(true),
    );
    apiRequests.length = 0;
    await user.selectOptions(selector, '');
    await waitFor(() =>
      expect(
        apiRequests.some(
          (url) => url.pathname.endsWith('/muhurta/day-summaries') && !url.searchParams.has('nakshatra'),
        ),
      ).toBe(true),
    );
    expect(apiRequests.every((url) => !url.searchParams.has('nakshatra'))).toBe(true);
  });

  it('offers the eleven activities as an accessible radio group with General selected by default', async () => {
    storeSelectedLocation();
    const { container } = renderRoute('/good-time', { auth: signedIn() });
    expect(await screen.findByRole('heading', { level: 1, name: 'Find a Good Time' })).toBeInTheDocument();
    await waitFor(() => expect(radios()).toHaveLength(11));

    expect(radios().map((r) => r.textContent)).toEqual([
      'Business',
      'Travel',
      'Property',
      'Vehicle',
      'Agreement',
      'Education',
      'Puja / Spiritual',
      'Wedding',
      'Housewarming',
      'General',
      'Other',
    ]);
    expect(radio('General')).toHaveAttribute('aria-checked', 'true');
    expect(radios().filter((r) => r.getAttribute('aria-checked') === 'true')).toHaveLength(1);
    // One tab stop for the whole group (roving tabindex).
    expect(radios().filter((r) => r.tabIndex === 0)).toEqual([radio('General')]);
    expect(await screen.findByText(NO_GOOD_TIME)).toBeInTheDocument();
    expect(await axeViolations(container)).toEqual([]);
  });

  it('says plainly when no Good Time qualifies, and never promotes another period', async () => {
    storeSelectedLocation();
    renderRoute('/good-time', { auth: signedIn() });
    expect(await screen.findByText(NO_GOOD_TIME)).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /^best recommended time/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try another date' })).toBeInTheDocument();
  });

  it('shows the recommended times with "Why this time?" from the backend, best first', async () => {
    await atInstant('2026-10-02T10:00:00-05:00');
    storeSelectedLocation();
    renderRoute('/good-time?activity=business&date=2026-10-01', { auth: signedIn() });
    // The same card as on phones: the best time, its status, and the backend's reasons behind "Why".
    const best = await screen.findByRole('region', { name: 'Best recommended times' });
    expect(best).toHaveTextContent(/08:53\sAM – 10:22\sAM/);
    expect(best).toHaveTextContent('Highly Favorable');
    expect(best).toHaveAttribute('data-status-tone', 'highly-favorable');
    const why = within(best).getByRole('button', { name: 'Why is this time recommended?' });
    expect(within(best).getByText('Highly Favorable for Business')).not.toBeVisible();
    await userEvent.click(why);
    expect(within(best).getByText('Highly Favorable for Business')).toBeVisible();
    expect(best).toHaveTextContent('✓ Favorable Nakshatra');
    expect(best).toHaveTextContent('✓ No Rahu Kalam conflict');
    expect(radio('Business')).toHaveAttribute('aria-checked', 'true');
  });

  it('explains favorable periods that are not recommended because of a conflict', async () => {
    storeSelectedLocation();
    renderRoute('/good-time?activity=business&date=2026-10-01', { auth: signedIn() });
    const section = await screen.findByRole('region', { name: 'Not recommended times' });
    const amrit = within(section)
      .getAllByRole('listitem')
      .find((item) => item.textContent?.includes('2:58'))!;
    expect(amrit).toHaveTextContent('✓ Amrita Kalam');
    expect(amrit).toHaveTextContent(/⚠ Overlaps Rahu Kalam/);
    expect(amrit).toHaveAttribute('data-status-tone', 'avoid');
    expect(within(section).getAllByText(/Overlaps Durmuhurtham/).length).toBeGreaterThan(0);
  });

  it('shows Mixed and Caution overlaps, the in-brief explanation and the disclaimer', async () => {
    storeSelectedLocation();
    renderRoute('/good-time?date=2026-10-20', { auth: signedIn() });
    // Several recommended times: all listed in the card, the best one highlighted.
    const best = await screen.findByRole('region', { name: 'Best recommended times' });
    expect(best).toHaveTextContent('Recommended times');
    const current = within(best)
      .getAllByRole('button')
      .filter((button) => button.getAttribute('aria-current') === 'true');
    expect(current).toHaveLength(1);
    const notRecommended = screen.getByRole('region', { name: 'Not recommended times' });
    const tones = within(notRecommended)
      .getAllByRole('listitem')
      .map((item) => item.getAttribute('data-status-tone'))
      .filter(Boolean);
    expect(tones).toEqual(expect.arrayContaining(['caution', 'mixed']));
    expect(notRecommended).toHaveTextContent('Overlaps Gulika Kalam');

    const brief = await screen.findByRole('region', { name: 'In brief' });
    expect(brief).toHaveTextContent(fixtures.muhurta.explanation.summary);
    expect(screen.getByText(fixtures.muhurta.goodTimes.austinGeneral.disclaimer)).toBeInTheDocument();
  });

  it('presets the activity from navigation and keeps it in the URL when it changes', async () => {
    storeSelectedLocation();
    const { router } = renderRoute('/good-time?activity=travel', { auth: signedIn() });
    await waitFor(() => expect(radio('Travel')).toHaveAttribute('aria-checked', 'true'));
    await userEvent.click(radio('Vehicle'));
    expect(radio('Vehicle')).toHaveAttribute('aria-checked', 'true');
    expect(router.state.location.search).toContain('activity=vehicle');
  });

  it('supports the keyboard: arrows move and select, and rapid changes send one request', async () => {
    storeSelectedLocation();
    renderRoute('/good-time?activity=business&date=2026-10-01', { auth: signedIn() });
    await screen.findByRole('region', { name: 'Best recommended times' });
    const before = goodTimeRequests().length;

    radio('Business').focus();
    await userEvent.keyboard('{ArrowRight}{ArrowRight}{ArrowRight}');
    expect(radio('Vehicle')).toHaveAttribute('aria-checked', 'true');
    expect(radio('Vehicle')).toHaveFocus();
    await userEvent.keyboard('{End}');
    expect(radio('Other')).toHaveAttribute('aria-checked', 'true');
    await userEvent.keyboard('{Home}');
    expect(radio('Business')).toHaveAttribute('aria-checked', 'true');
    await userEvent.keyboard('{ArrowLeft}');
    expect(radio('Other')).toHaveAttribute('aria-checked', 'true');
    await userEvent.keyboard('{ArrowLeft}');
    expect(radio('General')).toHaveAttribute('aria-checked', 'true');

    await waitFor(() => expect(goodTimeRequests().length).toBe(before + 1));
    expect(goodTimeRequests().at(-1)!.searchParams.get('activity')).toBe('general');
  });

  it('asks for a description for Other and reports the activity it was matched to', async () => {
    storeSelectedLocation();
    renderRoute('/good-time?activity=other', { auth: signedIn() });
    expect(await screen.findByText('Describe your activity to see good times.')).toBeInTheDocument();
    expect(goodTimeRequests().some((url) => url.searchParams.get('activity') === 'other')).toBe(false);

    await userEvent.type(screen.getByLabelText('Describe your activity'), 'Opening a bakery shop');
    await userEvent.click(screen.getByRole('button', { name: 'Find times' }));
    expect(await screen.findByText('Evaluated as Business.')).toBeInTheDocument();
    const request = goodTimeRequests().find((url) => url.searchParams.get('activity') === 'other')!;
    expect(request.searchParams.get('otherText')).toBe('Opening a bakery shop');
  });

  it('reports an error without losing the selection, and retries', async () => {
    server.use(scenarios.serverError('/muhurta/good-times'));
    storeSelectedLocation();
    renderRoute('/good-time?activity=travel', { auth: signedIn() });
    expect(await screen.findByText("We couldn't load good times.")).toBeInTheDocument();
    expect(radio('Travel')).toHaveAttribute('aria-checked', 'true');

    server.resetHandlers();
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await waitFor(() => expect(screen.queryByText("We couldn't load good times.")).not.toBeInTheDocument());
    expect(radio('Travel')).toHaveAttribute('aria-checked', 'true');
  });

  it("explains a day that is excluded for the activity with the backend's message", async () => {
    server.use(scenarios.json('/muhurta/good-times', fixtures.muhurta.goodTimes.hyderabadExcluded));
    storeSelectedLocation();
    renderRoute('/good-time?activity=business', { auth: signedIn() });
    expect(
      await screen.findByText(fixtures.muhurta.goodTimes.hyderabadExcluded.noGoodTimeMessage!),
    ).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: /^best recommended time/i })).not.toBeInTheDocument();
  });

  it('marks partial activities as guidance only', async () => {
    server.use(
      scenarios.json('/muhurta/good-times', {
        ...fixtures.muhurta.goodTimes.austinBusiness,
        activity: {
          ...fixtures.muhurta.goodTimes.austinBusiness.activity,
          key: 'wedding',
          name: 'Wedding',
          completeness: 'partial',
        },
      }),
    );
    storeSelectedLocation();
    renderRoute('/good-time?activity=wedding', { auth: signedIn() });
    expect(await screen.findByText(/Guidance only/)).toBeInTheDocument();
  });

  describe('Next best days', () => {
    const tile = () => screen.getByRole('complementary', { name: 'Next best days' });

    it('lists the best day of each day in the searched range, best first, and opens a day from one', async () => {
      storeSelectedLocation();
      const { router } = renderRoute('/good-time?activity=business', { auth: signedIn() });

      await waitFor(() => expect(within(tile()).getAllByRole('listitem').length).toBeGreaterThan(0));
      // The range starts on the chosen date (today) and covers 30 days by default.
      const request = apiRequests.find((url) => url.pathname.endsWith('/muhurta/day-summaries'))!;
      expect(request.searchParams.get('start')).toBe('2026-09-29');
      expect(request.searchParams.get('days')).toBe('30');
      expect(request.searchParams.get('activity')).toBe('business');
      const options = () =>
        within(tile())
          .getAllByRole('listitem')
          .filter((item) => item.parentElement?.tagName === 'OL');
      expect(options()).toHaveLength(3);
      // Highly Favorable days first.
      expect(options()[0]).toHaveAttribute('data-status-tone', 'highly-favorable');
      expect(options()[0]).toHaveTextContent('Highly Favorable');

      // View all lists every day in the range with a Good Time.
      await userEvent.click(within(tile()).getByRole('button', { name: /^View all recommended times/ }));
      expect(options().length).toBeGreaterThan(3);
      await userEvent.click(within(tile()).getByRole('button', { name: 'Show fewer' }));
      expect(options()).toHaveLength(3);

      // Opening the first option shows that day (highlighted); the range keeps its start.
      const first = options()[0]!;
      await userEvent.click(within(first).getByRole('button', { name: /^View / }));
      await waitFor(() => expect(router.state.location.search).toContain('from=2026-09-29'));
      await waitFor(() => expect(options()[0]).toHaveAttribute('aria-current', 'date'));
    });

    it('says so when no day in the range has a Good Time, and promotes nothing', async () => {
      server.use(
        scenarios.json('/muhurta/day-summaries', {
          ...fixtures.muhurta.daySummariesBusiness,
          days: fixtures.muhurta.daySummariesBusiness.days.map((day) => ({
            ...day,
            goodTimeCount: 0,
            bestGoodTime: null,
          })),
        }),
      );
      storeSelectedLocation();
      renderRoute('/good-time?activity=wedding', { auth: signedIn() });
      expect(
        await within(await screen.findByRole('complementary', { name: 'Next best days' })).findByText(
          'No good time was found in the next 30 days.',
        ),
      ).toBeInTheDocument();
      expect(within(tile()).queryByRole('button', { name: /View/ })).not.toBeInTheDocument();
    });

    it('waits for a description for Other', async () => {
      storeSelectedLocation();
      renderRoute('/good-time?activity=other', { auth: signedIn() });
      expect(await screen.findByText('Describe your activity to see the best times.')).toBeInTheDocument();
      expect(apiRequests.some((url) => url.pathname.endsWith('/muhurta/good-times/best'))).toBe(false);
    });
  });

  describe('month view', () => {
    it('synchronizes selected-date results, navigation, highlight and Today across month boundaries', async () => {
      await atInstant('2026-10-11T12:00:00-05:00');
      storeSelectedLocation();
      const { router, container } = renderRoute(
        '/good-time?activity=business&view=month&month=2026-10&date=2026-10-31',
        { auth: signedIn() },
      );
      await screen.findByRole('region', { name: 'Best recommended times' });
      expect(screen.getByRole('region', { name: 'Not recommended times' })).toBeInTheDocument();
      await screen.findByRole('region', { name: 'In brief' });
      // The evaluated day's Panchang cards (as on the Panchang calendar) instead of a status bar. They follow the
      // evaluation's date, which the mock fixes at October 1.
      expect(await screen.findByRole('region', { name: 'October 1 Panchang' })).toBeInTheDocument();
      expect(screen.getByRole('region', { name: 'Times to avoid on October 1' })).toBeInTheDocument();
      expect(screen.getByRole('region', { name: /^Why October 1 is / })).toBeInTheDocument();
      expect(screen.queryByRole('region', { name: 'The day at a glance' })).not.toBeInTheDocument();
      expect(
        within(screen.getByRole('group', { name: 'Date' })).getByText('Saturday, October 31'),
      ).toBeInTheDocument();
      expect(container.querySelector('input[type="date"], input[type="month"]')).toBeNull();
      expect(
        within(screen.getByRole('group', { name: 'Days of October 2026' })).getByRole('button', {
          name: /October 31/,
        }),
      ).toHaveAttribute('aria-pressed', 'true');
      await userEvent.click(screen.getByRole('button', { name: 'Next day' }));
      expect(router.state.location.search).toContain('date=2026-11-01');
      expect(
        within(screen.getByRole('group', { name: 'Date' })).getByText('Sunday, November 1'),
      ).toBeInTheDocument();
      const november = screen.getByRole('group', { name: 'Days of November 2026' });
      expect(within(november).getByRole('button', { name: /November 1(?:,|$)/ })).toHaveAttribute(
        'aria-pressed',
        'true',
      );
      for (const endpoint of ['good-times', 'good-times/explanation']) {
        await waitFor(() =>
          expect(
            apiRequests.some(
              (url) =>
                url.pathname.endsWith(`/muhurta/${endpoint}`) &&
                url.searchParams.get('date') === '2026-11-01',
            ),
          ).toBe(true),
        );
      }
      await waitFor(() =>
        expect(
          apiRequests.some(
            (url) =>
              url.pathname.endsWith('/muhurta/day-summaries') &&
              url.searchParams.get('start') === '2026-11-01' &&
              url.searchParams.get('days') === '30',
          ),
        ).toBe(true),
      );
      await userEvent.click(screen.getByRole('button', { name: 'Previous day' }));
      expect(router.state.location.search).toContain('date=2026-10-31');
      await userEvent.click(screen.getByRole('button', { name: 'Today' }));
      expect(router.state.location.search).not.toContain('date=');
      const today = todayIn('America/Chicago');
      expect(today).toBe('2026-10-11');
      expect(
        within(screen.getByRole('group', { name: 'Days of October 2026' })).getByRole('button', {
          name: /October 11/,
        }),
      ).toHaveAttribute('aria-pressed', 'true');
      expect(screen.getByRole('radio', { name: 'Month' })).toBeChecked();
    });

    const grid = () => screen.getByRole('group', { name: 'Days of October 2026' });

    it("shows each day's status and stays in month view until Day is selected", async () => {
      storeSelectedLocation();
      const { router, container } = renderRoute('/good-time?activity=business&view=month&month=2026-10', {
        auth: signedIn(),
      });

      expect(await screen.findByRole('heading', { name: 'October 2026' })).toBeInTheDocument();
      expect(screen.getByRole('radio', { name: 'Month' })).toBeChecked();
      await waitFor(() => expect(grid()).not.toHaveAttribute('aria-busy'));
      const days = within(grid()).getAllByRole('button');
      expect(days).toHaveLength(31);
      expect(days[0]).toHaveAccessibleName(/October 1.*Highly Favorable.*best 08:53\sAM – 10:22\sAM/);
      expect(days[0]).toHaveAttribute('data-status-tone', 'highly-favorable');
      expect(days[2]).toHaveAccessibleName(/October 3.*Mixed.*no good time/);
      expect(days[4]).toHaveAttribute('data-status-tone', 'avoid');

      const request = apiRequests.find((url) => url.pathname.endsWith('/muhurta/day-summaries'))!;
      expect(Object.fromEntries(request.searchParams)).toMatchObject({
        activity: 'business',
        start: '2026-10-01',
        days: '31',
      });
      expect(await axeViolations(container)).toEqual([]);

      await userEvent.click(days[3]!);
      await waitFor(() => expect(router.state.location.search).toContain('date=2026-10-04'));
      expect(router.state.location.search).toContain('view=month');
      expect(screen.getByRole('radio', { name: 'Month' })).toBeChecked();
      expect(grid()).toBeInTheDocument();
      await userEvent.click(within(grid()).getByRole('button', { name: /October 12/ }));
      expect(router.state.location.search).toContain('date=2026-10-12');
      expect(screen.getByRole('radio', { name: 'Month' })).toBeChecked();
      await userEvent.click(screen.getByRole('radio', { name: 'Day' }));
      expect(screen.getByRole('radio', { name: 'Day' })).toBeChecked();
      expect(router.state.location.search).not.toContain('view=month');
      await waitFor(() =>
        expect(goodTimeRequests().some((url) => url.searchParams.get('date') === '2026-10-12')).toBe(true),
      );
    });

    it('switches between day and month and moves between months', async () => {
      await atInstant('2026-10-11T12:00:00-05:00');
      storeSelectedLocation();
      const { router } = renderRoute('/good-time?activity=business&date=2026-10-01', { auth: signedIn() });
      await screen.findByRole('region', { name: 'Best recommended times' });

      await userEvent.click(screen.getByRole('radio', { name: 'Month' }));
      expect(await screen.findByRole('heading', { name: 'October 2026' })).toBeInTheDocument();
      expect(router.state.location.search).toContain('month=2026-10');
      expect(router.state.location.search).not.toContain('date=2026-10-01');
      expect(within(grid()).getByRole('button', { name: /October 11/ })).toHaveAttribute(
        'aria-pressed',
        'true',
      );

      await userEvent.click(screen.getByRole('button', { name: 'Next month' }));
      expect(await screen.findByRole('heading', { name: 'November 2026' })).toBeInTheDocument();
      await waitFor(() =>
        expect(
          apiRequests.some(
            (url) =>
              url.pathname.endsWith('/muhurta/day-summaries') &&
              url.searchParams.get('start') === '2026-11-01',
          ),
        ).toBe(true),
      );
      await waitFor(() =>
        expect(
          within(screen.getByRole('group', { name: 'Days of November 2026' })).getAllByRole('button'),
        ).toHaveLength(30),
      );
    });
  });
});
