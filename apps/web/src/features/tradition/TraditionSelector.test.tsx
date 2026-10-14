import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { createInMemoryAuthClient } from '../../shared/auth';
import { storeSelectedLocation } from '../../test/location-fixtures';
import { apiRequests, scenarios } from '../../test/msw/handlers';
import { server } from '../../test/msw/server';
import { renderRoute, renderWithProviders } from '../../test/render';
import { TraditionSelector } from './TraditionSelector';

describe('TraditionSelector', () => {
  it('waits for login before requesting the protected traditions catalog', async () => {
    const auth = createInMemoryAuthClient();
    renderWithProviders(<TraditionSelector />, { auth });
    expect(apiRequests.some((url) => url.pathname.endsWith('/traditions'))).toBe(false);
    await act(() => auth.signIn({ returnTo: '/help', intent: 'login' }));
    await waitFor(() => expect(screen.getAllByRole('option')).toHaveLength(8));
    expect(apiRequests.some((url) => url.pathname.endsWith('/traditions'))).toBe(true);
  });

  it('lists the traditions offered by the backend and defaults to configuration', async () => {
    renderWithProviders(<TraditionSelector showHint />, {
      auth: createInMemoryAuthClient({ user: { id: 'u1' } }),
    });
    const select = screen.getByRole('combobox', { name: 'Tradition' });
    await waitFor(() => expect(screen.getAllByRole('option')).toHaveLength(8));
    expect(select).toHaveValue('all');
    expect(screen.getByRole('option', { name: 'Telugu' })).toBeInTheDocument();
    expect(select).toHaveAccessibleDescription(/doesn’t depend on where you are/);
  });

  it('keeps signed-in choices temporary until Settings is saved', async () => {
    renderWithProviders(<TraditionSelector />, { auth: createInMemoryAuthClient({ user: { id: 'u1' } }) });
    await waitFor(() => expect(screen.getAllByRole('option')).toHaveLength(8));
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Tradition' }), 'tamil');
    expect(screen.getByRole('combobox', { name: 'Tradition' })).toHaveValue('tamil');
    expect(window.localStorage.getItem('mvs.tradition')).toBeNull();
    expect(apiRequests.some((url) => url.pathname.endsWith('/settings') && url.search)).toBe(false);
  });

  it('keeps working when the list cannot be loaded', async () => {
    server.use(scenarios.serverError('/traditions'));
    window.localStorage.setItem('mvs.tradition', '"telugu"');
    renderWithProviders(<TraditionSelector />, { auth: createInMemoryAuthClient({ user: { id: 'u1' } }) });
    expect(await screen.findByText('Traditions are unavailable right now.')).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Tradition' })).toHaveValue('telugu');
  });

  it('reloads the Panchang when the tradition changes, independent of location', async () => {
    // The selector is not shown on the home page: choose on another page, then open Home.
    storeSelectedLocation();
    renderRoute('/help', { auth: createInMemoryAuthClient({ user: { id: 'u1' } }) });
    const select = await screen.findByRole('combobox', { name: 'Tradition' });
    await waitFor(() => expect(screen.getAllByRole('option')).toHaveLength(8));
    await userEvent.selectOptions(select, 'north-indian');
    await userEvent.click(within(screen.getByRole('banner')).getByRole('link', { name: 'Home' }));
    await screen.findByText('Mixed');

    await waitFor(() =>
      expect(
        apiRequests.some(
          (u) => u.pathname.endsWith('/panchang/today') && u.searchParams.get('tradition') === 'north-indian',
        ),
      ).toBe(true),
    );
    const last = apiRequests.filter((u) => u.pathname.endsWith('/panchang/today')).at(-1)!;
    expect(last.searchParams.get('latitude')).toBe('30.27');
  });
});
