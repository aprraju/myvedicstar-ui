import { createMemorySink, createObservability } from '@myvedicstar/analytics';
import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it, vi } from 'vitest';

import { AppProviders } from '../../app/App';
import { RouteErrorPage } from '../../app/pages/RouteErrorPage';
import { axeViolations } from '../../test/axe';
import { createTestServices, fakeGeolocation } from '../../test/render';
import { AppErrorBoundary } from './AppErrorBoundary';

function Boom(): never {
  throw new Error('render failed for a@b.com');
}

describe('AppErrorBoundary', () => {
  it('shows the fallback and reports the error (redacted) instead of a blank page', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined); // React logs caught render errors
    const sink = createMemorySink();
    const { telemetry } = createObservability({ sinks: [sink], hasAnalyticsConsent: () => false });

    render(
      <AppErrorBoundary telemetry={telemetry} fallback={<p role="alert">Something went wrong</p>}>
        <Boom />
      </AppErrorBoundary>,
    );

    expect(screen.getByRole('alert')).toHaveTextContent('Something went wrong');
    expect(sink.items).toEqual([
      expect.objectContaining({
        type: 'exception',
        name: 'Error',
        message: 'render failed for [redacted]',
        properties: expect.objectContaining({ source: 'AppErrorBoundary' }),
      }),
    ]);
  });

  it('renders its children when nothing fails', () => {
    const { telemetry } = createObservability({ sinks: [], hasAnalyticsConsent: () => false });
    render(
      <AppErrorBoundary telemetry={telemetry} fallback={<p>fallback</p>}>
        <p>content</p>
      </AppErrorBoundary>,
    );
    expect(screen.getByText('content')).toBeInTheDocument();
    expect(screen.queryByText('fallback')).not.toBeInTheDocument();
  });
});

describe('RouteErrorPage', () => {
  it('replaces a failed route with a friendly, accessible page and reports the error', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { services, telemetry } = createTestServices();
    const router = createMemoryRouter([{ path: '/', element: <Boom />, errorElement: <RouteErrorPage /> }]);

    const { container } = render(
      <AppProviders services={services} language="en" geolocation={fakeGeolocation()}>
        <RouterProvider router={router} />
      </AppProviders>,
    );

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Something unexpected happened' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reload' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /home/i })).toHaveAttribute('href', '/');
    expect(container).not.toHaveTextContent('at Boom'); // never a stack trace
    expect(telemetry.items).toContainEqual(
      expect.objectContaining({
        type: 'exception',
        properties: expect.objectContaining({ source: 'RouteErrorPage' }),
      }),
    );
    expect(await axeViolations(container)).toEqual([]);
  });
});
