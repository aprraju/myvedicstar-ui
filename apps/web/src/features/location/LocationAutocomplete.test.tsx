import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';

import { axeViolations } from '../../test/axe';
import { server } from '../../test/msw/server';
import { createTestConfig, renderWithProviders } from '../../test/render';
import { LocationAutocomplete } from './LocationAutocomplete';

const base = 'https://api.test.myvedicstar.example/api/v1';
const india = {
  id: '1269843',
  city: 'Hyderabad',
  region: 'Telangana',
  country: 'India',
  countryCode: 'IN',
  postalCode: null,
  latitude: 17.385,
  longitude: 78.4867,
  source: 'city',
};
const pakistan = { ...india, id: '1176734', region: 'Sindh', country: 'Pakistan', countryCode: 'PK' };

function setup() {
  const onChoose = vi.fn();
  const calls: URL[] = [];
  server.use(
    http.get(`${base}/locations/search`, ({ request }) => {
      calls.push(new URL(request.url));
      return HttpResponse.json({ results: [india, pakistan] });
    }),
    http.get(`${base}/locations/postal`, ({ request }) => {
      calls.push(new URL(request.url));
      return HttpResponse.json({ results: [{ ...india, source: 'postal', postalCode: '110001' }] });
    }),
    http.get(`${base}/locations/timezone`, ({ request }) => {
      calls.push(new URL(request.url));
      return HttpResponse.json({ timeZone: 'Asia/Kolkata' });
    }),
    http.get(`${base}/locations/reverse`, () => HttpResponse.json({ place: india })),
  );
  const rendered = renderWithProviders(
    <LocationAutocomplete onChoose={onChoose} onSearchChange={() => undefined} />,
    {
      config: createTestConfig({ locationSearch: { enabled: true, debounceMs: 200 } }),
    },
  );
  return { ...rendered, onChoose, calls };
}

describe('GeoNames location autocomplete', () => {
  it('cancels obsolete requests and never displays their results after the input changes', async () => {
    setup();
    let started = false;
    let aborted = false;
    let release: () => void = () => undefined;
    const pending = new Promise<void>((resolve) => {
      release = resolve;
    });
    server.use(
      http.get(`${base}/locations/search`, async ({ request }) => {
        if (new URL(request.url).searchParams.get('text') === 'Hyderabad') {
          started = true;
          request.signal.addEventListener('abort', () => {
            aborted = true;
          });
          await pending;
          return HttpResponse.json({ results: [india] });
        }
        return HttpResponse.json({ results: [{ ...pakistan, city: 'London' }] });
      }),
    );
    const user = userEvent.setup();
    const input = screen.getByRole('combobox', { name: 'City, ZIP code or coordinates' });
    try {
      await user.type(input, 'Hyderabad');
      await waitFor(() => expect(started).toBe(true));
      await user.clear(input);
      await user.type(input, 'London');
      await waitFor(() => expect(aborted).toBe(true));
      await screen.findByRole('option', { name: 'London, Sindh, Pakistan' });
      expect(screen.queryByRole('option', { name: 'Hyderabad, Telangana, India' })).not.toBeInTheDocument();
    } finally {
      release();
    }
  });

  it('starts at the last suggestion with ArrowUp and wraps to the first with ArrowDown', async () => {
    setup();
    const user = userEvent.setup();
    await user.type(screen.getByRole('combobox', { name: 'City, ZIP code or coordinates' }), 'Hyderabad');
    await screen.findByRole('listbox');
    await user.keyboard('{ArrowUp}');
    expect(screen.getByRole('option', { name: 'Hyderabad, Sindh, Pakistan' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await user.keyboard('{ArrowDown}');
    expect(screen.getByRole('option', { name: 'Hyderabad, Telangana, India' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
  });

  it('shows distinct suggestions, supports arrow keys and Enter, and resolves timezone only on selection', async () => {
    const { onChoose, calls, container } = setup();
    const user = userEvent.setup();
    const input = screen.getByRole('combobox', { name: 'City, ZIP code or coordinates' });
    await user.type(input, 'Hyderabad');
    expect(await screen.findByRole('option', { name: 'Hyderabad, Telangana, India' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Hyderabad, Sindh, Pakistan' })).toBeInTheDocument();
    expect(calls.some((url) => url.pathname.endsWith('/timezone'))).toBe(false);
    expect(onChoose).not.toHaveBeenCalled();
    expect(await axeViolations(container)).toEqual([]);
    await user.keyboard('{ArrowDown}{Enter}');
    await waitFor(() =>
      expect(onChoose).toHaveBeenCalledWith(
        expect.objectContaining({ latitude: 17.385, longitude: 78.4867, timeZone: 'Asia/Kolkata' }),
      ),
    );
  });

  it('debounces requests, closes with Escape, clears input, and reuses cached results', async () => {
    const { calls } = setup();
    const user = userEvent.setup();
    const input = screen.getByRole('combobox', { name: 'City, ZIP code or coordinates' });
    await user.type(input, 'Hyderabad');
    await screen.findByRole('listbox');
    expect(calls.filter((url) => url.pathname.endsWith('/search'))).toHaveLength(1);
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Clear search' }));
    expect(input).toHaveValue('');
    await user.type(input, 'Hyderabad');
    await screen.findByRole('listbox');
    expect(calls.filter((url) => url.pathname.endsWith('/search'))).toHaveLength(1);
  });

  it('filters international postal searches by country and preserves manual coordinate precision', async () => {
    const { calls, onChoose } = setup();
    const user = userEvent.setup();
    await user.selectOptions(screen.getByRole('combobox', { name: 'Country' }), 'IN');
    const input = screen.getByRole('combobox', { name: 'City, ZIP code or coordinates' });
    await user.type(input, '110001');
    await screen.findByRole('listbox');
    expect(calls.find((url) => url.pathname.endsWith('/postal'))?.searchParams.get('country')).toBe('IN');
    await user.clear(input);
    await user.type(input, '17.385012, 78.486712');
    await user.click(screen.getByRole('button', { name: 'Search' }));
    await user.click(await screen.findByRole('button', { name: 'Use this location' }));
    expect(onChoose).toHaveBeenCalledWith(
      expect.objectContaining({ latitude: 17.385012, longitude: 78.486712 }),
    );
  });

  it('keeps selection unchanged on provider quota errors and offers retry', async () => {
    const { onChoose } = setup();
    server.use(
      http.get(`${base}/locations/search`, () =>
        HttpResponse.json({ status: 429, title: 'Rate limited' }, { status: 429 }),
      ),
    );
    const user = userEvent.setup();
    await user.type(screen.getByRole('combobox', { name: 'City, ZIP code or coordinates' }), 'Austin');
    expect(await screen.findByRole('button', { name: 'Try again' })).toBeInTheDocument();
    expect(onChoose).not.toHaveBeenCalled();
  });
});
