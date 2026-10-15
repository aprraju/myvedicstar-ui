import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { createInMemoryAuthClient } from '../../shared/auth';
import { axeViolations } from '../../test/axe';
import { atInstant, storeSelectedLocation } from '../../test/location-fixtures';
import { apiRequests, scenarios } from '../../test/msw/handlers';
import { server } from '../../test/msw/server';
import { renderRoute } from '../../test/render';

const signedIn = () => createInMemoryAuthClient({ user: { id: 'u1', displayName: 'Asha' } });
const grid = () => screen.getByRole('group', { name: /^Days of / });
const dayButton = (name: RegExp) => within(grid()).getByRole('button', { name });

/**
 * Synthetic months (see buildPanchangMonth): day 1 Shukla Ekadashi, day 5 Purnima, day 16 Krishna Ekadashi, day 20
 * Amavasya. Festivals: the real upcoming-festivals fixture, covering 2026-10-01 → 2026-11-29.
 */
describe('Calendar', () => {
  it('shows summary subcards only for the selected location current date', async () => {
    await atInstant('2026-09-29T10:00:00-05:00');
    storeSelectedLocation();
    renderRoute('/calendar?month=2026-09&day=2026-09-29', { auth: signedIn() });
    await screen.findByRole('region', { name: "Today's summary" });
    const summary = () => screen.getByRole('region', { name: "Today's summary" });
    await waitFor(() => expect(within(summary()).getByText('Next good time')).toBeInTheDocument());
    expect(within(summary()).getByText('Use caution now')).toBeInTheDocument();
    const user = userEvent.setup();
    await user.click(dayButton(/September 28/));
    await waitFor(() => expect(within(summary()).queryByText('Next good time')).not.toBeInTheDocument());
    expect(within(summary()).queryByText('Use caution now')).not.toBeInTheDocument();
    expect(within(summary()).getByRole('link', { name: 'Find a Good Time' })).toBeInTheDocument();
  });
  it('outside the festival window: each day’s Tithi, rating and Tithi-based observances, and today', async () => {
    await atInstant('2026-12-15T12:00:00-06:00');
    storeSelectedLocation();
    renderRoute('/calendar?month=2026-12', { auth: signedIn() });
    expect(await screen.findByRole('heading', { level: 1, name: 'December 2026' })).toBeInTheDocument();
    await waitFor(() => expect(dayButton(/^Tuesday, December 1,/)).toHaveAccessibleName(/Shukla Ekadashi/));

    expect(within(grid()).getAllByRole('button')).toHaveLength(31);
    expect(dayButton(/^Tuesday, December 1,/)).toHaveAccessibleName(
      'Tuesday, December 1, Shukla Ekadashi, Mixed, Ekadashi',
    );
    expect(within(dayButton(/^Tuesday, December 1,/)).getByText('Shukla Ekadashi')).toBeVisible();
    expect(
      dayButton(/^Tuesday, December 1,/).querySelector('[data-observance="ekadashi"]'),
    ).toHaveTextContent('Ekadashi');
    expect(dayButton(/^Saturday, December 5,/)).toHaveTextContent('Purnima');
    expect(dayButton(/^Sunday, December 20,/)).toHaveTextContent('Amavasya');
    const today = dayButton(/^Tuesday, December 15,/);
    expect(today).toHaveAttribute('aria-current', 'date');
    expect(today).toHaveAccessibleName(/today$/);
    // With no day in the URL, today is selected.
    expect(today).toHaveAttribute('aria-pressed', 'true');
    expect(apiRequests.some((u) => u.pathname.endsWith('/panchang/month/2026/12'))).toBe(true);
  });

  it('inside the festival window: tiles show the backend’s festivals (with +N), and the day panel lists them', async () => {
    await atInstant('2026-10-15T12:00:00-05:00');
    storeSelectedLocation();
    renderRoute('/calendar?month=2026-10&day=2026-10-20', { auth: signedIn() });
    await waitFor(() =>
      expect(dayButton(/^Tuesday, October 20,/)).toHaveTextContent('Vijayadashami (Dasara)'),
    );
    expect(dayButton(/^Tuesday, October 20,/)).toHaveAccessibleName(/Vijayadashami \(Dasara\)/);
    expect(dayButton(/^Tuesday, October 20,/)).toHaveTextContent('Amavasya');
    expect(within(dayButton(/^Tuesday, October 20,/)).getByText('Vijayadashami (Dasara)')).toBeVisible();
    // Oct 1 is synthetic Shukla Ekadashi, but the backend has no festival that day: no Tithi-based tag inside the window.
    expect(dayButton(/^Thursday, October 1,/)).toHaveAccessibleName(
      'Thursday, October 1, Shukla Ekadashi, Mixed',
    );
    expect(dayButton(/^Tuesday, October 6,/)).toHaveTextContent('Ekadashi');

    const panel = screen.getByRole('list', { name: 'Festivals & observances' });
    expect(panel).toHaveTextContent('Vijayadashami (Dasara)');
  });

  it('shows "+N" when a day has several festivals', async () => {
    await atInstant('2026-10-15T12:00:00-05:00');
    storeSelectedLocation();
    renderRoute('/calendar?month=2026-11&day=2026-11-06', { auth: signedIn() });
    // 6 November: Dhana Trayodashi and Masik Shivaratri.
    await waitFor(() => expect(dayButton(/^Friday, November 6,/)).toHaveTextContent('Dhana Trayodashi'));
    expect(dayButton(/^Friday, November 6,/)).toHaveTextContent('+1');
    expect(screen.getByRole('list', { name: 'Festivals & observances' })).toHaveTextContent(
      'Masik Shivaratri',
    );
  });

  it('shows the selected day’s Panchang, auspicious times and times to avoid', async () => {
    await atInstant('2026-10-15T12:00:00-05:00');
    storeSelectedLocation();
    renderRoute('/calendar?month=2026-10&day=2026-10-05', { auth: signedIn() });
    expect(await screen.findByRole('heading', { level: 2, name: 'Monday, October 5' })).toBeInTheDocument();
    // October 5 uses its guidance rating (Caution), even when the General status is Avoid.
    const status = screen
      .getAllByText('Caution')
      .map((element) => element.closest('[data-status-tone]'))
      .find(Boolean);
    expect(status).toHaveAttribute('data-status-tone', 'caution');
    const panchang = screen.getByRole('region', { name: /^\w+ \d{1,2} Panchang$/ });
    expect(panchang).toHaveTextContent('Purnima');
    expect(panchang).toHaveTextContent('Monday');
    expect(screen.getByRole('region', { name: /^Auspicious times on \w+ \d{1,2}$/ })).toHaveTextContent(
      'Amrita Kalam',
    );
    expect(screen.getByRole('region', { name: /^Times to avoid on \w+ \d{1,2}$/ })).toHaveTextContent(
      'Rahu Kalam',
    );
    // The selected day's timeline sits under the calendar, without a "Now" marker for another date.
    const timeline = screen.getByRole('region', { name: 'October 5 timeline' });
    expect(timeline).toHaveTextContent(/Sunrise\s*07:23\sAM/);
    expect(within(timeline).queryByText('Now')).not.toBeInTheDocument();
    // Another date: no Now / Over badges.
    expect(
      within(screen.getByRole('region', { name: /^Times to avoid on \w+ \d{1,2}$/ })).queryByText('Over'),
    ).not.toBeInTheDocument();
  });

  it('selecting a day updates the panel and the URL', async () => {
    await atInstant('2026-10-15T12:00:00-05:00');
    storeSelectedLocation();
    const { router } = renderRoute('/calendar?month=2026-10', { auth: signedIn() });
    await screen.findByRole('heading', { level: 2, name: 'Thursday, October 15' });
    await userEvent.click(dayButton(/^Tuesday, October 20,/));
    expect(await screen.findByRole('heading', { level: 2, name: 'Tuesday, October 20' })).toBeInTheDocument();
    expect(new URLSearchParams(router.state.location.search).get('day')).toBe('2026-10-20');
    expect(dayButton(/^Tuesday, October 20,/)).toHaveAttribute('aria-pressed', 'true');
  });

  it('moves between months and back to today', async () => {
    await atInstant('2026-10-15T12:00:00-05:00');
    storeSelectedLocation();
    const { router } = renderRoute('/calendar?month=2026-10', { auth: signedIn() });
    await screen.findByRole('heading', { level: 1, name: 'October 2026' });

    await userEvent.click(screen.getByRole('button', { name: 'Next month' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'November 2026' })).toBeInTheDocument();
    await waitFor(() =>
      expect(apiRequests.some((u) => u.pathname.endsWith('/panchang/month/2026/11'))).toBe(true),
    );
    await waitFor(() => expect(within(grid()).getAllByRole('button')).toHaveLength(30));

    await userEvent.click(screen.getByRole('button', { name: 'Previous month' }));
    await userEvent.click(screen.getByRole('button', { name: 'Previous month' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'September 2026' })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Today' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'October 2026' })).toBeInTheDocument();
    const search = new URLSearchParams(router.state.location.search);
    expect([search.get('month'), search.get('day')]).toEqual(['2026-10', '2026-10-15']);
  });

  it('ignores a malformed month in the URL and shows the current month', async () => {
    await atInstant('2026-10-15T12:00:00-05:00');
    storeSelectedLocation();
    renderRoute('/calendar?month=<script>', { auth: signedIn() });
    expect(await screen.findByRole('heading', { level: 1, name: 'October 2026' })).toBeInTheDocument();
  });

  it('asks for a location when none is selected', async () => {
    renderRoute('/calendar', { auth: signedIn() });
    expect(await screen.findByText('Choose a location to see today’s Panchang')).toBeInTheDocument();
    expect(screen.queryByRole('group', { name: /^Days of / })).not.toBeInTheDocument();
  });

  it('shows a friendly error with retry when the month cannot be loaded', async () => {
    server.use(scenarios.serverError('/panchang/month/:year/:month'));
    storeSelectedLocation();
    renderRoute('/calendar?month=2026-10', { auth: signedIn() });
    expect(await screen.findByText("We couldn't load this month's Panchang.")).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });

  it('has no accessibility violations', async () => {
    await atInstant('2026-10-15T12:00:00-05:00');
    storeSelectedLocation();
    const { container } = renderRoute('/calendar?month=2026-10', { auth: signedIn() });
    await screen.findByRole('region', { name: /^Times to avoid on \w+ \d{1,2}$/ });
    expect(await axeViolations(container)).toEqual([]);
  });
});
