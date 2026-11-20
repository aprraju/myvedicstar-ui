import { fireEvent, screen } from '@testing-library/react';
import { useState } from 'react';
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
    // Announced once, from the section's single live region; the visible copy is hidden from assistive tech so it is
    // not read a second time.
    expect(screen.getByRole('status')).toHaveTextContent(/Loading Yogas/);
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

  /**
   * Node identity across the load transition — test-only coverage, no behaviour change.
   *
   * \`AssessmentHost\` satisfies this property BY RECONCILIATION ORDER, not by construction: its region is the fragment's
   * first child in the same slot, of the same type, with no key, so React updates that node's text and keeps the DOM
   * element. That is correct today and it is fragile in a specific way — inserting a wrapper, adding a key, or moving
   * the region below a branch would replace the node and break the announcement without changing a single rendered
   * snapshot. Nothing asserted that before this test.
   *
   * Without this comment the test reads as guarding something structural. It is not: it pins a property that currently
   * holds by React's reconciliation rules, so nobody later "simplifies" the fragment and silently loses it.
   */
  it('keeps the same live region node across loading to ready, by reconciliation rather than structure', () => {
    // A stateful wrapper rather than rerender(): rerender() replaces the whole tree, providers included, which unmounts
    // everything and would test the harness instead of the host. This drives the same component through the transition
    // inside one provider, which is what the real page does when the query resolves.
    function Harness() {
      const [resolved, setResolved] = useState(false);
      return (
        <>
          <button type="button" onClick={() => setResolved(true)}>
            resolve
          </button>
          <AssessmentHost
            title="Yogas"
            status={resolved ? 'ready' : 'loading'}
            data={resolved ? { ok: true } : null}
            errorKind={null}
            reload={() => undefined}
          >
            {() => <p>payload</p>}
          </AssessmentHost>
        </>
      );
    }

    renderWithProviders(<Harness />);

    // Captured while loading.
    const region = screen.getByRole('status');
    expect(region).toHaveTextContent(/Loading Yogas/);

    fireEvent.click(screen.getByRole('button', { name: /resolve/i }));

    // Same element, still connected, now carrying the loaded text.
    expect(region.isConnected).toBe(true);
    expect(document.body.contains(region)).toBe(true);
    expect(region).toHaveTextContent(/loaded/i);
  });
});
