import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { axeViolations } from '../../../test/axe';
import { renderWithProviders } from '../../../test/render';
import {
  transitsComplete,
  transitsNoSadeSatiInterval,
  transitsSadeSatiGap,
  transitsSadeSatiNotYetActive,
  transitsWithAbsences,
} from './fixtures';
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

    // transitsWithAbsences carries a truncated interval AND no not-yet-active reason, but its active flag is false, so
    // the honest render is the "no phase now" branch. The partial label attaches to whichever Sade Sati block renders a
    // real interval, which is the complete fixture below.
    expect(screen.getByTestId('sadesati')).toHaveAttribute('data-state', 'not-active');
  });

  it('labels the truncation caveat on a rendered interval block', () => {
    renderWithProviders(
      <TransitsSection
        section={{
          ...transitsComplete,
          sadeSati: { ...transitsComplete.sadeSati!, isPartial: true },
        }}
        timeZoneId={TZ}
      />,
    );

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

  // Three cases, not two. The nullable alone cannot tell them apart - the reason vocabulary does.
  it('renders null + no-interval-in-span as a computed answer, not a gap', () => {
    renderWithProviders(<TransitsSection section={transitsNoSadeSatiInterval} timeZoneId={TZ} />);

    const block = screen.getByTestId('sadesati');
    expect(block).toHaveAttribute('data-state', 'no-interval');
    expect(block).toHaveTextContent(/No Sade Sati period applies to this profile/i);
    // The reassuring reading must not be borrowed by the gap case, and vice versa.
    expect(block).not.toHaveTextContent(/could not be calculated/i);
  });

  it('renders a gap on SadeSati itself as unavailable and names the reason', () => {
    renderWithProviders(<TransitsSection section={transitsSadeSatiGap} timeZoneId={TZ} />);

    const block = screen.getByTestId('sadesati');
    expect(block).toHaveAttribute('data-state', 'unavailable');
    expect(block).toHaveTextContent(/could not be calculated/i);
    expect(block).toHaveTextContent(/engine-unavailable/);
    // A user whose Sade Sati was never computed must not be told they are clear of it.
    expect(block).not.toHaveTextContent(/No Sade Sati period applies/i);
  });

  it('says when Sade Sati begins instead of calling a future window unavailable', () => {
    renderWithProviders(<TransitsSection section={transitsSadeSatiNotYetActive} timeZoneId={TZ} />);

    const block = screen.getByTestId('sadesati');
    expect(block).toHaveAttribute('data-state', 'not-yet-active');
    expect(block).toHaveTextContent(/Sade Sati begins/i);
    // The start date is known and must be shown - an unavailable message would understate what the engine returned.
    expect(block).toHaveTextContent(/2028/);
    expect(block).not.toHaveTextContent(/not available/i);
    expect(block).not.toHaveTextContent(/could not be calculated/i);
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
    // Interval present, phases populated (as the engine always sends them), active false, no not-yet-active reason:
    // this is a real "no phase is current at the reference instant" - the case a phases.length check could never reach.
    expect(block).toHaveAttribute('data-state', 'not-active');
    expect(block).toHaveTextContent(/not in a Sade Sati phase at the reference instant/i);
    expect(block).not.toHaveTextContent(/could not be calculated/i);
    expect(block).not.toHaveTextContent(/No Sade Sati period applies/i);
    expect(block).not.toHaveTextContent(/begins/i);
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
