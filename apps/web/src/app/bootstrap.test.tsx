import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { TEST_API_BASE_URL } from '../test/msw/handlers';
import { server } from '../test/msw/server';
import { bootstrap } from './bootstrap';

function serveConfig(response: Response | (() => Response)) {
  server.use(http.get('*/config.json', () => (typeof response === 'function' ? response() : response)));
}

async function start() {
  const container = document.createElement('div');
  document.body.append(container);
  await act(() => bootstrap(container));
  return container;
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('bootstrap', () => {
  it('starts the app with the validated runtime configuration', async () => {
    serveConfig(HttpResponse.json({ environment: 'test', apiBaseUrl: `${TEST_API_BASE_URL}/api/v1` }));
    await start();
    expect(
      await screen.findByRole('heading', { level: 1, name: /find auspicious moments/i }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/could not start/i)).not.toBeInTheDocument();
  });

  it.each([
    [
      'invalid',
      () => HttpResponse.json({ environment: 'production', apiBaseUrl: 'http://insecure.example' }),
    ],
    ['missing', () => new HttpResponse(null, { status: 404 })],
  ])(
    'shows a friendly error instead of starting half-configured when the config is %s',
    async (_, response) => {
      const logged = vi.spyOn(console, 'error').mockImplementation(() => undefined);
      serveConfig(response);
      await start();

      expect(await screen.findByRole('alert')).toHaveTextContent(
        'My Vedic Star could not start because it is not configured correctly.',
      );
      expect(screen.getByRole('button', { name: /reload/i })).toBeInTheDocument();
      expect(screen.queryByRole('banner')).not.toBeInTheDocument();
      expect(logged).toHaveBeenCalledWith('My Vedic Star failed to start', expect.any(Error));
    },
  );

  it('reloads the page from the configuration error screen', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const reload = vi.fn();
    vi.spyOn(window, 'location', 'get').mockReturnValue({ ...window.location, reload });
    serveConfig(() => new HttpResponse(null, { status: 500 }));
    await start();

    await userEvent.click(await screen.findByRole('button', { name: /reload/i }));
    expect(reload).toHaveBeenCalledOnce();
  });
});
