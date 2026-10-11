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
const card = (name: RegExp) =>
  screen
    .getAllByRole('listitem')
    .find((item) => within(item).queryByRole('heading', { name })) as HTMLElement;

/** Fixture: real API response for Austin, Telugu, captured 2026-10-01 (60 days). */
describe('Festivals', () => {
  it('lists upcoming festivals and observances by month for the selected location and tradition', async () => {
    storeSelectedLocation();
    renderRoute('/festivals', { auth: signedIn() });
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Festivals & Observances' }),
    ).toBeInTheDocument();
    expect(await screen.findByText('Upcoming in Austin, Texas, Telugu tradition')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'October 2026' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'November 2026' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3, name: 'Vijayadashami (Dasara)' })).toBeInTheDocument();

    const request = apiRequests.find((u) => u.pathname.endsWith('/festivals/upcoming'))!;
    expect(Object.fromEntries(request.searchParams)).toMatchObject({
      tradition: 'all',
      language: 'en',
      days: '30',
    });
  });

  it('shows date, how soon, description, observance moment and the Tithi window', async () => {
    storeSelectedLocation();
    renderRoute('/festivals', { auth: signedIn() });
    await screen.findByRole('heading', { level: 2, name: 'October 2026' });
    const ekadashi = card(/^Ekadashi$/);
    expect(ekadashi).toHaveTextContent('Tuesday, October 6');
    expect(ekadashi).toHaveTextContent('In 5 days');
    expect(ekadashi).toHaveTextContent('Observance');
    expect(ekadashi).toHaveTextContent('observed with fasting in honor of Lord Vishnu');
    expect(ekadashi).toHaveTextContent(/Observed at Sunrise: Oct 6, 07:27\sAM/);
    expect(ekadashi).toHaveTextContent(/Tithi: Oct 5, 03:37\sPM – Oct 6, 02:04\sPM/);

    const pradosham = card(/^Pradosham$/);
    expect(pradosham).toHaveTextContent(/Observed at Pradosha: Oct 7, 07:08\sPM – Oct 7, 09:36\sPM/);

    expect(card(/^Sankranti$/)).toHaveTextContent(/Sankranti: Oct 17, /);
  });

  it('filters festivals / observances and changes the range (kept in the URL)', async () => {
    storeSelectedLocation();
    const { router } = renderRoute('/festivals', { auth: signedIn() });
    await screen.findByRole('heading', { level: 2, name: 'October 2026' });

    await userEvent.click(screen.getByRole('button', { name: 'Festivals' }));
    expect(screen.getByRole('button', { name: 'Festivals' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByRole('heading', { level: 3, name: /^Ekadashi$/ })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3, name: 'Deepavali (Lakshmi Puja)' })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Observances' }));
    expect(
      screen.queryByRole('heading', { level: 3, name: 'Deepavali (Lakshmi Puja)' }),
    ).not.toBeInTheDocument();
    expect(screen.getAllByRole('heading', { level: 3, name: /^Ekadashi$/ }).length).toBeGreaterThan(0);

    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Show the next' }), '60');
    await waitFor(() => expect(apiRequests.some((u) => u.searchParams.get('days') === '60')).toBe(true));
    const search = new URLSearchParams(router.state.location.search);
    expect([search.get('show'), search.get('days')]).toEqual(['observance', '60']);
  });

  it('asks for a location when none is selected', async () => {
    renderRoute('/festivals', { auth: signedIn() });
    expect(await screen.findByText('Choose a location to see today’s Panchang')).toBeInTheDocument();
  });

  it('shows a friendly error with retry', async () => {
    server.use(scenarios.serverError('/festivals/upcoming'));
    storeSelectedLocation();
    renderRoute('/festivals', { auth: signedIn() });
    expect(await screen.findByText("We couldn't load upcoming festivals.")).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });

  it('explains an empty period', async () => {
    const { fixtures } = await import('@myvedicstar/testing');
    server.use(scenarios.json('/festivals/upcoming', { ...fixtures.festivals, festivals: [] }));
    storeSelectedLocation();
    renderRoute('/festivals', { auth: signedIn() });
    expect(await screen.findByText('No festivals or observances in this period.')).toBeInTheDocument();
  });

  it('has no accessibility violations', async () => {
    storeSelectedLocation();
    const { container } = renderRoute('/festivals', { auth: signedIn() });
    await screen.findByRole('heading', { level: 2, name: 'October 2026' });
    expect(await axeViolations(container)).toEqual([]);
  });
});
