import { screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { TEST_API_BASE_URL } from '../../../test/msw/handlers';
import { server } from '../../../test/msw/server';
import { renderWithProviders } from '../../../test/render';
import { CapabilitiesHost } from './CapabilitiesHost';
import { capabilitiesFixture } from './fixtures';

/**
 * The boundary must never block the page, and must never invent a default set when it cannot be loaded.
 *
 * The failure path is the important one: falling back to an assumed capability list would reintroduce precisely the
 * drift this feature exists to remove, and it would do so silently.
 */
describe('CapabilitiesHost — failure never becomes an assumption', () => {
  it('renders the loading state without a blocking spinner', () => {
    renderWithProviders(<CapabilitiesHost />);
    // The region is the announcement; the visible paragraph is now aria-hidden to avoid a double announcement, so
    // the element that carries role="status" is the region, not the copy.
    expect(screen.getByTestId('capabilities-announcement')).toHaveAttribute('role', 'status');
    expect(screen.getByTestId('capabilities-loading')).toHaveAttribute('aria-hidden', 'true');
  });

  it('reports an unavailable boundary rather than showing any capability list', async () => {
    // The test harness has no handler for the capabilities endpoint, so the request fails.
    renderWithProviders(<CapabilitiesHost />);

    await waitFor(() => expect(screen.getByTestId('capabilities-failure')).toBeInTheDocument());
    expect(screen.queryByTestId('divisional-list')).not.toBeInTheDocument();
    // No default list is presented in its place.
    expect(screen.queryByTestId('shadbala-capability-list')).not.toBeInTheDocument();
    // Two elements carry this sentence now: the live region (the announcement) and the visible failure panel. Both are
    // legitimate - the region is what a screen reader hears, the panel is what a sighted user reads.
    expect(screen.getAllByText(/nothing is assumed/i).length).toBeGreaterThan(0);
  });

  it('offers a retry control that is a real button', async () => {
    renderWithProviders(<CapabilitiesHost />);
    await waitFor(() => expect(screen.getByTestId('capabilities-failure')).toBeInTheDocument());
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
  });
});

/**
 * ui#134 — node identity across the transition, not presence per state.
 *
 * The three-return structure gives each state its own \`role="status"\` element. Every one of those is individually
 * valid markup, and every presence-based assertion passes against it — which is why the defect survived review. What
 * fails is identity: the region captured while loading is not the region that announces failure, so a screen reader
 * has no reason to connect the second node's text to the first node's disappearance, and the announcement the code
 * intends is the one that most reliably does not happen.
 *
 * These assertions are copied in shape from KundaliPageA11y.test.tsx, where the same property is asserted for the
 * page's yogas region.
 */
describe('CapabilitiesHost — one live region across the transition', () => {
  it('keeps the same status node from loading into failure', async () => {
    renderWithProviders(<CapabilitiesHost />);

    // Captured while loading, before the failed request settles. The ordering is the assertion.
    const loadingRegion = await waitFor(() => {
      const found = Array.from(document.querySelectorAll('[role="status"]')).find((node) =>
        /loading/i.test(node.textContent ?? ''),
      );
      expect(found, 'the host announces loading from its own region').toBeDefined();
      return found as Element;
    });

    // The request fails (no handler in the harness), so the state flips to failure.
    await waitFor(() => expect(screen.getByTestId('capabilities-failure')).toBeInTheDocument());

    // Same element: the node captured during loading is still the one announcing, with new text.
    expect(loadingRegion.isConnected).toBe(true);
    expect(document.body.contains(loadingRegion)).toBe(true);
    expect(loadingRegion.textContent).toMatch(/could not be loaded|nothing is assumed/i);
  });

  it('keeps the same status node from loading into ready, with the request held open', async () => {
    // The handler must HOLD the request, not resolve it. An immediately-resolving handler produces a transition that
    // has already finished before the test can stand on it - and an identity assertion across a completed transition
    // proves nothing. The gate is what makes the loading state observable.
    let release: (() => void) | undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    server.use(
      http.get(`${TEST_API_BASE_URL}/api/v1/kundali/capabilities`, async () => {
        await gate;
        return HttpResponse.json(capabilitiesFixture);
      }),
    );

    renderWithProviders(<CapabilitiesHost />);

    // Captured while the request is still open. If the gate above were absent this would already be the loaded state.
    const region = await waitFor(() => {
      const found = Array.from(document.querySelectorAll('[role="status"]')).find((node) =>
        /loading/i.test(node.textContent ?? ''),
      );
      expect(found, 'the host announces loading while the request is held').toBeDefined();
      return found as Element;
    });

    release?.();
    await waitFor(() => expect(screen.getByTestId('capabilities-announcement')).toBeInTheDocument());

    // Same element across loading -> ready, carrying the new text.
    expect(region.isConnected).toBe(true);
    expect(document.body.contains(region)).toBe(true);
    expect(region.textContent).not.toMatch(/loading/i);
  });
});
