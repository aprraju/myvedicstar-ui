import { todayIn } from '@myvedicstar/date-time';
import { fixtures } from '@myvedicstar/testing';
import { focusManager } from '@tanstack/react-query';
import { act, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createInMemoryAuthClient } from '../../shared/auth';
import { atInstant, storeSelectedLocation } from '../../test/location-fixtures';
import { apiRequests } from '../../test/msw/handlers';
import { server } from '../../test/msw/server';
import { renderRoute, renderWithProviders } from '../../test/render';
import { usePanchangToday } from './usePanchangToday';

function Probe() {
  const { query } = usePanchangToday();
  return <output>{query.data?.days[0]?.date ?? 'Loading current date'}</output>;
}

afterEach(() => focusManager.setFocused(undefined));

describe('Today cache integration', () => {
  it('reuses Today when returning from Calendar without another Today request', async () => {
    await atInstant('2026-09-29T10:00:00-05:00');
    storeSelectedLocation();
    // Upcoming Events loads Today (its day banner).
    const { router } = renderRoute('/festivals', {
      auth: createInMemoryAuthClient({ user: { id: 'cache-user' } }),
    });
    await waitFor(() =>
      expect(apiRequests.filter((url) => url.pathname.endsWith('/panchang/today'))).toHaveLength(1),
    );
    await act(async () => {
      await router.navigate('/calendar');
    });
    await screen.findByRole('heading', { name: 'September 2026' });
    await act(async () => {
      await router.navigate('/festivals');
    });
    await screen.findByRole('heading', { level: 1, name: 'Festivals & Observances' });
    expect(apiRequests.filter((url) => url.pathname.endsWith('/panchang/today'))).toHaveLength(1);
  });

  it('removes yesterday from Today immediately on resume across local midnight', async () => {
    await atInstant('2026-09-29T23:59:59-05:00');
    storeSelectedLocation();
    let release: (() => void) | undefined;
    const pending = new Promise<void>((resolve) => {
      release = resolve;
    });
    server.use(
      http.get('https://api.test.myvedicstar.example/api/v1/panchang/today', async () => {
        const date = todayIn('America/Chicago');
        if (date === '2026-09-30') await pending;
        return HttpResponse.json({
          ...fixtures.panchang.austinTelugu,
          localToday: date,
          days: [{ ...fixtures.panchang.austinTelugu.days[0], date }],
        });
      }),
    );
    renderWithProviders(<Probe />, { auth: createInMemoryAuthClient({ user: { id: 'cache-user' } }) });
    await screen.findByText('2026-09-29');
    await atInstant('2026-09-30T00:00:01-05:00');
    await act(async () => {
      focusManager.setFocused(false);
      focusManager.setFocused(true);
    });
    expect(screen.queryByText('2026-09-29')).not.toBeInTheDocument();
    expect(screen.getByText('Loading current date')).toBeInTheDocument();
    release?.();
    await screen.findByText('2026-09-30');
  });

  it('rejects an API response for yesterday instead of caching it under today', async () => {
    await atInstant('2026-09-30T10:00:00-05:00');
    storeSelectedLocation();
    const request = vi.fn();
    server.use(
      http.get('https://api.test.myvedicstar.example/api/v1/panchang/today', () => {
        request();
        return HttpResponse.json(fixtures.panchang.austinTelugu);
      }),
    );
    const { services } = renderWithProviders(<Probe />, {
      auth: createInMemoryAuthClient({ user: { id: 'cache-user' } }),
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });
    expect(request).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('2026-09-29')).not.toBeInTheDocument();
    expect(
      services.queryClient
        .getQueryCache()
        .findAll({ queryKey: ['panchang', 'today'] })
        .every((query) => query.state.data === undefined),
    ).toBe(true);
  });
});
