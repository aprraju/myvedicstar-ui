import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { createInMemoryAuthClient } from '../../shared/auth';
import { storeSelectedLocation } from '../../test/location-fixtures';
import { server } from '../../test/msw/server';
import { renderRoute } from '../../test/render';

describe('protected route session rejection', () => {
  it('shows an explicit retry instead of a second sign-in when a page API returns 401', async () => {
    const auth = createInMemoryAuthClient({ user: { id: 'u1' } });
    storeSelectedLocation();
    server.use(http.get('*/api/v1/festivals/upcoming', () => new HttpResponse(null, { status: 401 })));
    const { router } = renderRoute('/festivals', { auth });
    expect(await screen.findByRole('alert')).toHaveTextContent("We couldn't sign you in");
    await waitFor(() => expect(router.state.location.pathname).toBe('/auth/callback'));
    expect(new URLSearchParams(router.state.location.search).get('returnTo')).toBe('/festivals');
    expect(auth.requests).toHaveLength(0);
    expect(await auth.getAccessToken()).toBeNull();
    await router.navigate('/about');
    await router.navigate('/festivals');
    await waitFor(() => expect(router.state.location.pathname).toBe('/auth/callback'));
    expect(await screen.findByRole('alert')).toHaveTextContent("We couldn't sign you in");
    expect(auth.requests).toHaveLength(0);
    // Only a deliberate retry can start another authentication round trip.
    server.resetHandlers();
    await userEvent.click(await screen.findByRole('button', { name: 'Try again' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/festivals'));
    expect(auth.requests).toEqual([{ intent: 'login', returnTo: '/festivals' }]);
  });
});
