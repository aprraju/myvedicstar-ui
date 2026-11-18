import { divisionalState, shadbalaState } from '@myvedicstar/contracts';
import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { renderWithProviders } from '../../../test/render';
import { CapabilitiesPanel } from './CapabilitiesPanel';
import { capabilitiesEmpty, capabilitiesFixture } from './fixtures';

/**
 * ui#111. The property under test is the THREE-way distinction, not "the list renders".
 *
 * D60 is the case: supported, provisional, or absent are three different claims, and a test that only checks the
 * supported list contains numbers would pass even if provisional and absent had been collapsed into it.
 */
describe('capabilities — provisional is not supported and not absent', () => {
  it('renders D60 as provisional, with its own label and note', () => {
    renderWithProviders(<CapabilitiesPanel capabilities={capabilitiesFixture} />);

    const d60 = screen.getByTestId('provisional-60');
    expect(d60).toHaveAttribute('data-state', 'provisional');
    expect(d60).toHaveTextContent('Provisional');
    expect(d60).toHaveTextContent(/not asserted as definitive/i);
  });

  it('does not render D60 among the supported entries', () => {
    renderWithProviders(<CapabilitiesPanel capabilities={capabilitiesFixture} />);

    const list = screen.getByTestId('divisional-list');
    const d60 = within(list)
      .getAllByRole('listitem')
      .filter((item) => item.getAttribute('data-divisions') === '60');
    expect(d60).toHaveLength(1);
    expect(d60[0]).toHaveAttribute('data-state', 'provisional');
  });

  it('renders a supported division as supported, without the provisional note', () => {
    renderWithProviders(<CapabilitiesPanel capabilities={capabilitiesFixture} />);

    const list = screen.getByTestId('divisional-list');
    const d9 = within(list)
      .getAllByRole('listitem')
      .find((item) => item.getAttribute('data-divisions') === '9');
    expect(d9).toBeDefined();
    expect(d9).toHaveAttribute('data-state', 'supported');
    expect(d9?.textContent).not.toMatch(/provisional/i);
  });

  it('resolves states from the payload alone: supported / provisional / absent', () => {
    // The contract-level decision, exercised directly so a rendering change cannot mask a wrong classification.
    expect(divisionalState(capabilitiesFixture, 9).kind).toBe('supported');
    expect(divisionalState(capabilitiesFixture, 60).kind).toBe('provisional');
    // 5 is in neither list. It must be absent, not assumed supported.
    expect(divisionalState(capabilitiesFixture, 5).kind).toBe('absent');
  });

  it('treats a division present in BOTH lists as provisional, never supported', () => {
    // Should not happen, but if it does the weaker claim is the safe reading.
    const overlapping = {
      ...capabilitiesFixture,
      supportedDivisionalCharts: [...capabilitiesFixture.supportedDivisionalCharts, 60],
    };
    expect(divisionalState(overlapping, 60).kind).toBe('provisional');
  });
});

describe('capabilities — absent reads as absent', () => {
  it('names a withheld Shadbala component as not calculated and attaches no value', () => {
    renderWithProviders(<CapabilitiesPanel capabilities={capabilitiesFixture} />);

    const chesta = screen.getByTestId('absent-Chesta');
    expect(chesta).toHaveAttribute('data-state', 'absent');
    expect(chesta).toHaveTextContent(/not calculated/i);
    // The failure this guards: a withheld component rendered as 0.
    expect(chesta.textContent).not.toMatch(/\b0\b/);
    expect(chesta.querySelector('[data-value]')).toBeNull();
  });

  it('reports an unsupported component as absent even when the payload omits it from both lists', () => {
    expect(shadbalaState(capabilitiesFixture, 'Chesta').kind).toBe('absent');
    expect(shadbalaState(capabilitiesFixture, 'Sthana').kind).toBe('supported');
    // Unknown to the boundary is absent, never "probably supported".
    expect(shadbalaState(capabilitiesFixture, 'Bhava')).toBeDefined();
    expect(shadbalaState(capabilitiesFixture, 'Bhava').kind).toBe('absent');
  });

  it('states that nothing is supported rather than showing an empty list', () => {
    renderWithProviders(<CapabilitiesPanel capabilities={capabilitiesEmpty} />);

    const list = screen.getByTestId('divisional-list');
    expect(within(list).getByText(/no divisional charts are supported/i)).toBeInTheDocument();
  });
});

describe('capabilities — provenance and conventions', () => {
  it('shows the conventions and the supported birth-date range from the payload', () => {
    renderWithProviders(<CapabilitiesPanel capabilities={capabilitiesFixture} />);

    expect(screen.getByText('MeanNode')).toBeInTheDocument();
    expect(screen.getByText('GeocentricTrueSidereal')).toBeInTheDocument();
    expect(screen.getByText('1800-01-01 to 2200-12-31')).toBeInTheDocument();
  });

  it('shows the published limits verbatim', () => {
    renderWithProviders(<CapabilitiesPanel capabilities={capabilitiesFixture} />);

    const limits = screen.getByTestId('unsupported-capabilities');
    expect(limits).toHaveTextContent(/Chesta Bala is not computed/);
  });

  it('is a labelled region with a heading, so it can be navigated to', () => {
    renderWithProviders(<CapabilitiesPanel capabilities={capabilitiesFixture} />);
    expect(
      screen.getByRole('heading', { name: /what this chart can calculate/i, level: 2 }),
    ).toBeInTheDocument();
  });
});
