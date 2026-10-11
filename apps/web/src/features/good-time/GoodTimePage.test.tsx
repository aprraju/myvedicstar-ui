import { fixtures } from '@myvedicstar/testing';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { createInMemoryAuthClient } from '../../shared/auth';
import { axeViolations } from '../../test/axe';
import { storeSelectedLocation } from '../../test/location-fixtures';
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
    for (const endpoint of ['good-times', 'good-times/explanation', 'good-times/best']) {
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
    expect(screen.queryByRole('heading', { name: /Recommended time/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try another date' })).toBeInTheDocument();
  });

  it('shows the recommended times with "Why this time?" from the backend, best first', async () => {
    storeSelectedLocation();
    renderRoute('/good-time?activity=business&date=2026-10-01', { auth: signedIn() });
    const section = await screen.findByRole('region', { name: 'Recommended time' });
    const [best] = within(section)
      .getAllByRole('listitem')
      .filter((item) => item.parentElement?.tagName === 'OL');
    expect(best).toHaveTextContent(/8:53\sAM – 10:22\sAM/);
    expect(best).toHaveTextContent('Highly Favorable for Business');
    expect(best).toHaveTextContent('Best');
    expect(best).toHaveTextContent('Why this time?');
    expect(best).toHaveTextContent('✓ Favorable Nakshatra');
    expect(best).toHaveTextContent('✓ No Rahu Kalam conflict');
    expect(best).toHaveAttribute('data-status-tone', 'highly-favorable');
    expect(radio('Business')).toHaveAttribute('aria-checked', 'true');
  });

  it('explains favorable periods that are not recommended because of a conflict', async () => {
    storeSelectedLocation();
    renderRoute('/good-time?activity=business&date=2026-10-01', { auth: signedIn() });
    const section = await screen.findByRole('region', { name: 'Not recommended' });
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
    expect(await screen.findByRole('region', { name: 'Recommended times' })).toBeInTheDocument();
    const notRecommended = screen.getByRole('region', { name: 'Not recommended' });
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
    await screen.findByRole('region', { name: 'Recommended time' });
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
    expect(screen.queryByRole('region', { name: /Recommended time/ })).not.toBeInTheDocument();
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

  describe('Next best times', () => {
    const tile = () => screen.getByRole('complementary', { name: 'Next best times' });

    it("lists the backend's best options in its order, and opens a day from one", async () => {
      storeSelectedLocation();
      const { router } = renderRoute('/good-time?activity=business', { auth: signedIn() });

      await waitFor(() => expect(within(tile()).getAllByRole('listitem').length).toBeGreaterThan(0));
      const options = within(tile())
        .getAllByRole('listitem')
        .filter((item) => item.parentElement?.tagName === 'OL');
      expect(options).toHaveLength(3);
      expect(options[0]).toHaveTextContent(/October 2/);
      expect(options[0]).toHaveTextContent(/2:30\sPM – 4:17\sPM/);
      expect(options[0]).toHaveTextContent('Highly Favorable');
      expect(options[0]).toHaveAttribute('data-status-tone', 'highly-favorable');
      expect(options[1]).toHaveTextContent(/October 4/);
      expect(options[2]).toHaveTextContent(/October 12/);
      const best = apiRequests.find((url) => url.pathname.endsWith('/muhurta/good-times/best'))!;
      expect(best.searchParams.get('activity')).toBe('business');
      expect(best.searchParams.get('count')).toBe('3');

      await userEvent.click(within(tile()).getByRole('button', { name: /View .*October 4/ }));
      await waitFor(() => expect(router.state.location.search).toContain('date=2026-10-04'));
      await waitFor(() =>
        expect(goodTimeRequests().some((url) => url.searchParams.get('date') === '2026-10-04')).toBe(true),
      );
    });

    it("shows the backend's message when no Good Time qualifies, and promotes nothing", async () => {
      server.use(
        scenarios.json('/muhurta/good-times/best', {
          ...fixtures.muhurta.best.austinBusiness,
          options: [],
          noGoodTimeMessage: 'No Good Time was found for this activity in the next 30 days.',
        }),
      );
      storeSelectedLocation();
      renderRoute('/good-time?activity=wedding', { auth: signedIn() });
      expect(
        await within(await screen.findByRole('complementary', { name: 'Next best times' })).findByText(
          'No Good Time was found for this activity in the next 30 days.',
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
      expect(days[0]).toHaveAccessibleName(/October 1.*Highly Favorable.*best 8:53\sAM – 10:22\sAM/);
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
      const best = screen.getByRole('complementary', { name: 'Next best times' });
      await userEvent.click(within(best).getByRole('button', { name: /View .*October 12/ }));
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
      storeSelectedLocation();
      const { router } = renderRoute('/good-time?activity=business&date=2026-10-01', { auth: signedIn() });
      await screen.findByRole('region', { name: 'Recommended time' });

      await userEvent.click(screen.getByRole('radio', { name: 'Month' }));
      expect(await screen.findByRole('heading', { name: 'October 2026' })).toBeInTheDocument();
      expect(router.state.location.search).toContain('month=2026-10');

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
