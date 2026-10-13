import { fixtures } from '@myvedicstar/testing';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { createInMemoryAuthClient } from '../../shared/auth';
import { apiRequests, atInstant, renderApp as renderTestApp, storeLocation } from '../../test/render';
import { GoodTimeScreen } from './GoodTimeScreen';

const renderApp = (
  routes: Parameters<typeof renderTestApp>[0],
  options: Parameters<typeof renderTestApp>[1] = {},
) => renderTestApp(routes, { ...options, auth: createInMemoryAuthClient({ user: { id: 'u1' } }) });

const NO_GOOD_TIME =
  'No strongly favorable time was found for this activity today. Please choose another date.';
const goodTimeRequests = () => apiRequests.filter((url) => url.pathname.endsWith('/muhurta/good-times'));

/** Fixtures: real API responses for Austin, Telugu tradition (see packages/testing). */
describe('Find a Good Time (mobile)', () => {
  it('offers the activities with General selected, and says plainly when no Good Time qualifies', async () => {
    await storeLocation();
    await renderApp({ index: () => <GoodTimeScreen /> });

    // Eleven activities, plus the Day / Month view switch.
    await waitFor(() => expect(screen.getAllByRole('radio')).toHaveLength(13));
    expect(screen.getByRole('radio', { name: 'General' }).props.accessibilityState).toMatchObject({
      checked: true,
    });
    expect(await screen.findByText(NO_GOOD_TIME)).toBeTruthy();
    expect(screen.queryByText(/Recommended time/)).toBeNull();
    expect(screen.getByRole('button', { name: 'Try another date' })).toBeTruthy();
    expect(goodTimeRequests().at(-1)!.searchParams.get('activity')).toBe('general');
  });

  it('shows the recommended times with the reasons from the backend', async () => {
    await storeLocation();
    await renderApp({ index: () => <GoodTimeScreen initialActivity="business" /> });

    expect(
      await screen.findByLabelText(/^08:53\sAM – 10:22\sAM\. Highly Favorable for Business\./),
    ).toBeTruthy();
    expect(screen.getAllByText('✓ No Rahu Kalam conflict').length).toBeGreaterThan(0);
    // Amrit Kalam overlapping Rahu Kalam is explained, not recommended.
    expect(screen.getByText('Not recommended')).toBeTruthy();
    expect(screen.getAllByText(/⚠ Overlaps Rahu Kalam/).length).toBeGreaterThan(0);
    expect(screen.getByText(fixtures.muhurta.goodTimes.austinBusiness.disclaimer)).toBeTruthy();
  });

  it('asks for a description for Other before evaluating it', async () => {
    await storeLocation();
    await renderApp({ index: () => <GoodTimeScreen initialActivity="other" /> });

    expect(await screen.findByText('Describe your activity to see good times.')).toBeTruthy();
    expect(goodTimeRequests().some((url) => url.searchParams.get('activity') === 'other')).toBe(false);

    await fireEvent.changeText(screen.getByLabelText('Describe your activity'), 'Opening a bakery shop');
    await fireEvent.press(screen.getByRole('button', { name: 'Find times' }));

    expect(await screen.findByText('Evaluated as Business.')).toBeTruthy();
    const request = goodTimeRequests().find((url) => url.searchParams.get('activity') === 'other')!;
    expect(request.searchParams.get('otherText')).toBe('Opening a bakery shop');
  });

  it("shows the backend's next best times in a separate tile, and opens a day from one", async () => {
    await storeLocation();
    await renderApp({ index: () => <GoodTimeScreen initialActivity="business" /> });

    expect(await screen.findByText('Next best times')).toBeTruthy();
    const first = await screen.findByLabelText(
      /^Option 1\. .*October 2.*02:30\sPM – 04:17\sPM\. Highly Favorable/,
    );
    expect(first).toBeTruthy();
    expect(screen.getByLabelText(/^Option 2\. .*October 4/)).toBeTruthy();
    expect(screen.getByLabelText(/^Option 3\. .*October 12/)).toBeTruthy();
    const best = apiRequests.filter((url) => url.pathname.endsWith('/muhurta/good-times/best')).at(-1)!;
    expect(best.searchParams.get('activity')).toBe('business');

    await fireEvent.press(screen.getByRole('button', { name: /View .*October 4/ }));
    await waitFor(() =>
      expect(
        apiRequests.some(
          (url) =>
            url.pathname.endsWith('/muhurta/good-times') && url.searchParams.get('date') === '2026-10-04',
        ),
      ).toBe(true),
    );
  });

  it("shows the month for the activity, with each day's backend status, and opens a day", async () => {
    atInstant('2026-10-02T10:00:00-05:00');
    await storeLocation();
    await renderApp({ index: () => <GoodTimeScreen initialActivity="business" /> });

    await fireEvent.press(await screen.findByRole('radio', { name: 'Month' }));
    expect(await screen.findByText('October 2026')).toBeTruthy();
    expect(
      await screen.findByLabelText(/October 1.*Highly Favorable.*best 08:53\sAM – 10:22\sAM/),
    ).toBeTruthy();
    expect(screen.getByLabelText(/October 3.*Mixed.*no good time/)).toBeTruthy();
    const month = apiRequests.find((url) => url.pathname.endsWith('/muhurta/day-summaries'))!;
    expect(Object.fromEntries(month.searchParams)).toMatchObject({
      activity: 'business',
      start: '2026-10-01',
      days: '31',
    });

    await fireEvent.press(screen.getByRole('button', { name: /^\w+, October 4, .*Highly Favorable/ }));
    expect(screen.getByRole('radio', { name: 'Day' }).props.accessibilityState).toMatchObject({
      checked: true,
    });
    await waitFor(() =>
      expect(
        apiRequests.some(
          (url) =>
            url.pathname.endsWith('/muhurta/good-times') && url.searchParams.get('date') === '2026-10-04',
        ),
      ).toBe(true),
    );
  });
});
