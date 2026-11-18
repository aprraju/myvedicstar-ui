import { screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { renderWithProviders } from '../../../test/render';
import { CapabilitiesHost } from './CapabilitiesHost';

/**
 * The boundary must never block the page, and must never invent a default set when it cannot be loaded.
 *
 * The failure path is the important one: falling back to an assumed capability list would reintroduce precisely the
 * drift this feature exists to remove, and it would do so silently.
 */
describe('CapabilitiesHost — failure never becomes an assumption', () => {
  it('renders the loading state without a blocking spinner', () => {
    renderWithProviders(<CapabilitiesHost />);
    expect(screen.getByTestId('capabilities-loading')).toHaveAttribute('role', 'status');
  });

  it('reports an unavailable boundary rather than showing any capability list', async () => {
    // The test harness has no handler for the capabilities endpoint, so the request fails.
    renderWithProviders(<CapabilitiesHost />);

    await waitFor(() => expect(screen.getByTestId('capabilities-failure')).toBeInTheDocument());
    expect(screen.queryByTestId('divisional-list')).not.toBeInTheDocument();
    // No default list is presented in its place.
    expect(screen.queryByTestId('shadbala-capability-list')).not.toBeInTheDocument();
    expect(screen.getByText(/nothing is assumed/i)).toBeInTheDocument();
  });

  it('offers a retry control that is a real button', async () => {
    renderWithProviders(<CapabilitiesHost />);
    await waitFor(() => expect(screen.getByTestId('capabilities-failure')).toBeInTheDocument());
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
  });
});
