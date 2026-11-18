import { screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { axeViolations } from '../../../test/axe';
import { renderWithProviders } from '../../../test/render';
import { capabilitiesFixture } from '../capabilities/fixtures';
import { DivisionPicker } from './DivisionPicker';

/**
 * #111 acceptance test: the section must read its support from the fetched boundary.
 *
 * The guard that matters is not "it renders" — it is that the SAME component renders DIFFERENTLY for two boundaries
 * that disagree about a chart. A component that hardcodes its divisions, or falls back to the contract's static
 * `divisionalChartValues`, renders identically for both of these payloads and fails every assertion below.
 *
 * That is the revert guard: it cannot be satisfied by importing the hook without changing a behaviour, which is the
 * distinction the issue draws.
 */

const LABELS = ['D1', 'D9', 'D30', 'D60', 'BhavaChalit'] as const;

/** D60 provisional, D30 absent from both lists - the adversarial shape, not the happy path. */
const narrow = {
  ...capabilitiesFixture,
  supportedDivisionalCharts: [1, 9],
  provisionalDivisionalCharts: [60],
};

/** A different deployment where D30 IS supported and D60 is absent entirely. */
const wider = {
  ...capabilitiesFixture,
  supportedDivisionalCharts: [1, 9, 30],
  provisionalDivisionalCharts: [],
};

describe('KUN-20 boundary — the chart list is derived from the fetched capabilities', () => {
  it('offers a chart the boundary supports, and labels it supported', () => {
    renderWithProviders(
      <DivisionPicker capabilities={narrow} labels={LABELS} selected={null} onSelect={() => undefined} />,
    );

    const option = screen.getByTestId('division-option-D9');
    expect(option).toHaveAttribute('data-state', 'supported');
    expect(within(option).getByText(/Supported/)).toBeInTheDocument();
  });

  it('labels a provisional chart provisional rather than supported', () => {
    renderWithProviders(
      <DivisionPicker capabilities={narrow} labels={LABELS} selected={null} onSelect={() => undefined} />,
    );

    const option = screen.getByTestId('division-option-D60');
    // The specific failure this feature exists to prevent: presenting a provisional result as definitive.
    expect(option).toHaveAttribute('data-state', 'provisional');
    expect(within(option).getByText(/Provisional/)).toBeInTheDocument();
    expect(within(option).queryByText(/^Supported$/)).not.toBeInTheDocument();
  });

  it('labels a chart absent from the boundary as absent, never as supported', () => {
    renderWithProviders(
      <DivisionPicker capabilities={narrow} labels={LABELS} selected={null} onSelect={() => undefined} />,
    );

    const option = screen.getByTestId('division-option-D30');
    expect(option).toHaveAttribute('data-state', 'absent');
    expect(within(option).getByText(/Not calculated/)).toBeInTheDocument();
  });

  it('CHANGES with the boundary: the same labels render differently for a different capability report', () => {
    // This is the revert guard. A hardcoded section produces identical output for both payloads, so this assertion is
    // the one that cannot be satisfied without actually reading the boundary.
    const { unmount } = renderWithProviders(
      <DivisionPicker capabilities={narrow} labels={LABELS} selected={null} onSelect={() => undefined} />,
    );
    expect(screen.getByTestId('division-option-D30')).toHaveAttribute('data-state', 'absent');
    expect(screen.getByTestId('division-option-D60')).toHaveAttribute('data-state', 'provisional');
    unmount();

    renderWithProviders(
      <DivisionPicker capabilities={wider} labels={LABELS} selected={null} onSelect={() => undefined} />,
    );
    expect(screen.getByTestId('division-option-D30')).toHaveAttribute('data-state', 'supported');
    expect(screen.getByTestId('division-option-D60')).toHaveAttribute('data-state', 'absent');
  });

  it('does not invent a capability for a non-numeric division the boundary does not describe', () => {
    renderWithProviders(
      <DivisionPicker capabilities={wider} labels={LABELS} selected={null} onSelect={() => undefined} />,
    );

    // BhavaChalit has no numeric division, so the boundary's lists cannot speak to it. It is reported absent rather
    // than assumed supported: "if missing then supported" is the client-side derivation the contract forbids.
    expect(screen.getByTestId('division-option-BhavaChalit')).toHaveAttribute('data-state', 'absent');
  });

  it('reports the boundary counts it was given, not a fixed number', () => {
    renderWithProviders(
      <DivisionPicker capabilities={narrow} labels={LABELS} selected={null} onSelect={() => undefined} />,
    );
    expect(screen.getByText(/2 supported, 1 provisional/)).toBeInTheDocument();
  });

  it('calls onSelect with the chosen division', async () => {
    const onSelect = vi.fn();
    renderWithProviders(
      <DivisionPicker capabilities={narrow} labels={LABELS} selected={null} onSelect={onSelect} />,
    );
    screen.getByTestId('division-option-D9').click();
    expect(onSelect).toHaveBeenCalledWith('D9');
  });

  it('says so rather than rendering an empty group when no divisions are offered', () => {
    renderWithProviders(
      <DivisionPicker capabilities={narrow} labels={[]} selected={null} onSelect={() => undefined} />,
    );
    expect(screen.queryByTestId('division-picker')).not.toBeInTheDocument();
    expect(screen.getByText(/No divisional charts are available/i)).toBeInTheDocument();
  });

  it('has no axe violations with all three states present', async () => {
    const { container } = renderWithProviders(
      <DivisionPicker capabilities={narrow} labels={LABELS} selected="D9" onSelect={() => undefined} />,
    );
    expect(await axeViolations(container)).toEqual([]);
  });
});
