import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '../../../test/render';
import { AssessmentHost } from './AssessmentHost';

/**
 * The host separates "we could not fetch" from "the engine cannot compute". Showing a server reason code for a network
 * failure would be a fabricated explanation, and showing a plain error card for a legitimate unsupported payload would
 * hide the real answer.
 */
describe('AssessmentHost', () => {
  it('renders children once data arrives', () => {
    renderWithProviders(
      <AssessmentHost
        title="Yogas"
        status="ready"
        data={{ ok: true }}
        errorKind={null}
        reload={() => undefined}
      >
        {(data) => <p>payload {String(data.ok)}</p>}
      </AssessmentHost>,
    );
    expect(screen.getByText('payload true')).toBeInTheDocument();
  });

  it('shows a loading state, never an unavailable reason, while in flight', () => {
    renderWithProviders(
      <AssessmentHost title="Yogas" status="loading" data={null} errorKind={null} reload={() => undefined}>
        {() => <p>should not render</p>}
      </AssessmentHost>,
    );
    expect(screen.getByText(/Loading Yogas/)).toBeInTheDocument();
    expect(screen.queryByText('should not render')).not.toBeInTheDocument();
    expect(screen.queryByText(/Reason code/)).not.toBeInTheDocument();
  });

  it('shows a retryable error with no invented reason code', () => {
    const reload = vi.fn();
    renderWithProviders(
      <AssessmentHost title="Yogas" status="error" data={null} errorKind="server" reload={reload}>
        {() => <p>should not render</p>}
      </AssessmentHost>,
    );

    expect(screen.getByRole('alert')).toHaveTextContent(/Yogas could not be loaded/);
    expect(screen.queryByText(/Reason code/)).not.toBeInTheDocument();
    screen.getByRole('button', { name: 'Try again' }).click();
    expect(reload).toHaveBeenCalled();
  });

  it('explains a 404 as an ownership problem rather than as an unavailable calculation', () => {
    renderWithProviders(
      <AssessmentHost title="Yogas" status="error" data={null} errorKind="notFound" reload={() => undefined}>
        {() => null}
      </AssessmentHost>,
    );
    expect(screen.getByText(/not found, or it is not one of yours/)).toBeInTheDocument();
  });
});
