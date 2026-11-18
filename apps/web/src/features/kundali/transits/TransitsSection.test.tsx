import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { axeViolations } from '../../../test/axe';
import { renderWithProviders } from '../../../test/render';
import { transitsComplete, transitsWithAbsences } from './fixtures';
import { TransitsSection } from './TransitsSection';

const TZ = 'Asia/Kolkata';

describe('KUN-13 transits — an absence is never rendered as a value', () => {
  it('renders an absent graha as unavailable rather than as zero degrees or direct', () => {
    renderWithProviders(<TransitsSection section={transitsWithAbsences} timeZoneId={TZ} />);

    const jupiter = screen.getByTestId('transit-jupiter');
    expect(jupiter).toHaveAttribute('data-state', 'absent');
    expect(within(jupiter).getByText(/not available for this profile/i)).toBeInTheDocument();
    // The two ways this fixture can be rendered wrongly: a fabricated 0.00° or a fabricated "Direct".
    expect(within(jupiter).queryByText(/0\.00°/)).not.toBeInTheDocument();
    expect(within(jupiter).queryByText(/Direct/)).not.toBeInTheDocument();
  });

  it('renders an unevaluated field on a present graha as unavailable, not as a number', () => {
    renderWithProviders(<TransitsSection section={transitsWithAbsences} timeZoneId={TZ} />);

    const saturn = screen.getByTestId('transit-saturn');
    expect(saturn).toHaveAttribute('data-state', 'present');
    expect(within(saturn).getByText('Pisces')).toBeInTheDocument();
    // longitude and isRetrograde are both null in the fixture: two "not available" cells, no number, no motion verdict.
    expect(within(saturn).getAllByText(/Not available/i)).toHaveLength(2);
    expect(within(saturn).queryByText(/Retrograde/)).not.toBeInTheDocument();
    expect(within(saturn).queryByText(/Direct/)).not.toBeInTheDocument();
  });

  it('renders real values when the engine did evaluate them', () => {
    renderWithProviders(<TransitsSection section={transitsComplete} timeZoneId={TZ} />);

    const saturn = screen.getByTestId('transit-saturn');
    expect(within(saturn).getByText('350.42°')).toBeInTheDocument();
    expect(within(saturn).getByText('Direct')).toBeInTheDocument();
    const jupiter = screen.getByTestId('transit-jupiter');
    expect(within(jupiter).getByText('104.16°')).toBeInTheDocument();
    expect(within(jupiter).getByText('Retrograde')).toBeInTheDocument();
  });
});

describe('KUN-13 Sade Sati — a truncated interval is labelled as truncated', () => {
  it('labels a partial interval on the same block as the dates it qualifies', () => {
    renderWithProviders(<TransitsSection section={transitsWithAbsences} timeZoneId={TZ} />);

    const block = screen.getByTestId('sadesati');
    expect(block).toHaveAttribute('data-partial', 'true');
    expect(within(block).getByTestId('sadesati-partial')).toHaveTextContent(
      /cut short at the edge of the calculation range/i,
    );
    // The caveat must not be a page-level footnote: it lives inside the Sade Sati block itself.
    expect(within(block).getByText(/Observed/)).toBeInTheDocument();
  });

  it('does not label a complete interval as partial', () => {
    renderWithProviders(<TransitsSection section={transitsComplete} timeZoneId={TZ} />);

    const block = screen.getByTestId('sadesati');
    expect(block).toHaveAttribute('data-partial', 'false');
    expect(within(block).queryByTestId('sadesati-partial')).not.toBeInTheDocument();
  });

  it('says Sade Sati is unavailable instead of inventing a phase when the engine reported none', () => {
    renderWithProviders(
      <TransitsSection section={{ ...transitsComplete, sadeSati: null }} timeZoneId={TZ} />,
    );
    const block = screen.getByTestId('sadesati');
    // "Never calculated" and "calculated, no phase" are different facts and must read differently.
    expect(block).toHaveAttribute('data-state', 'not-calculated');
    expect(block).toHaveTextContent(/was not calculated for this profile/i);
    expect(block).not.toHaveTextContent(/not applicable/i);
  });
});

describe('KUN-13 Sade Sati — absence wording distinguishes the two kinds of absence', () => {
  it('says "not in a phase" when the engine calculated it and found none', () => {
    renderWithProviders(
      <TransitsSection
        section={{
          ...transitsComplete,
          sadeSati: {
            ...transitsComplete.sadeSati!,
            active: false,
            phases: [],
          },
        }}
        timeZoneId={TZ}
      />,
    );

    const block = screen.getByTestId('sadesati');
    expect(block).toHaveAttribute('data-state', 'not-active');
    expect(block).toHaveTextContent(/not in a Sade Sati phase at the reference instant/i);
    // It must not claim the calculation was missing: it was not.
    expect(block).not.toHaveTextContent(/was not calculated/i);
  });
});

describe('KUN-13 transits — freshness and unsupported elements are stated', () => {
  it('states the reference, computed and expiry instants', () => {
    renderWithProviders(<TransitsSection section={transitsComplete} timeZoneId={TZ} />);
    const freshness = screen.getByText(/Refers to/i);
    expect(freshness).toHaveTextContent(/Computed/);
    expect(freshness).toHaveTextContent(/Valid until/);
  });

  it('lists withheld elements with their reason rather than dropping them', () => {
    renderWithProviders(<TransitsSection section={transitsWithAbsences} timeZoneId={TZ} />);
    const list = screen.getByTestId('transits-unsupported');
    expect(within(list).getByText(/transits\.jupiter/)).toBeInTheDocument();
    expect(within(list).getByText(/insufficient-data/)).toBeInTheDocument();
  });

  it('says there are no dated events instead of rendering an empty table', () => {
    renderWithProviders(<TransitsSection section={transitsWithAbsences} timeZoneId={TZ} />);
    expect(screen.getByTestId('dated-transits')).toHaveTextContent(/No dated transit events/i);
  });

  it('has no axe violations with absences, a partial interval and withheld elements all present', async () => {
    const { container } = renderWithProviders(
      <TransitsSection section={transitsWithAbsences} timeZoneId={TZ} />,
    );
    expect(await axeViolations(container)).toEqual([]);
  });
});
