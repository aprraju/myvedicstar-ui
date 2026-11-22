import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { axeViolations } from '../../../test/axe';
import { renderWithProviders } from '../../../test/render';
import {
  type CategoryScore,
  comparisonTotal,
  type ComparisonView,
  CONTRACT_NOT_AVAILABLE,
  fromComparisonPayload,
  type IndeterminateReason,
  indeterminateReasonKey,
  indeterminateReasonValues,
  isScored,
} from './comparisonAdapter';
import { ComparisonSection, ComparisonTable } from './ComparisonTable';

/** A scored category. Kept as a helper so the fixtures state their kind rather than implying it. */
const scored = (score: number, max: number): CategoryScore => ({ kind: 'scored', score, max });
const indeterminate = (reason: IndeterminateReason): CategoryScore => ({
  kind: 'indeterminate',
  reason,
});

const view = (categories: [string, CategoryScore][], scoredMax = 36): ComparisonView => ({
  categories: categories.map(([code, score]) => ({ code, score })),
  total: comparisonTotal(categories.map(([code, score]) => ({ code, score }))),
  scoredMax,
});

describe('KUN-15 comparison — an indeterminate category is never a zero', () => {
  it('renders an indeterminate category as its own state, with no numeric value anywhere in the row', () => {
    renderWithProviders(
      <ComparisonTable
        comparison={view([
          ['varna', scored(1, 1)],
          ['nadi', indeterminate('birth-time-unknown')],
        ])}
        labelA="Asha"
        labelB="Ravi"
      />,
    );

    const row = screen.getByTestId('comparison-row-nadi');
    expect(row).toHaveAttribute('data-state', 'indeterminate');

    // The two failure shapes this test exists to catch: a 0 printed for the absent score, and a 0 of 0 fraction.
    expect(within(row).queryByText(/\b0\b/)).not.toBeInTheDocument();
    expect(within(row).getByText(/Cannot be determined/)).toBeInTheDocument();
    expect(within(row).getByText(/the birth time is unknown/)).toBeInTheDocument();
  });

  it('never renders a scored row as indeterminate, and never the reverse', () => {
    renderWithProviders(
      <ComparisonTable
        comparison={view([
          ['varna', scored(1, 1)],
          ['nadi', indeterminate('birth-time-approximate')],
        ])}
        labelA="Asha"
        labelB="Ravi"
      />,
    );

    const varna = screen.getByTestId('comparison-row-varna');
    expect(varna).toHaveAttribute('data-state', 'scored');
    expect(within(varna).getByText('1 of 1')).toBeInTheDocument();

    expect(screen.getByTestId('comparison-row-nadi')).toHaveAttribute('data-state', 'indeterminate');
  });

  it('withholds the total when any category is indeterminate, rather than summing the scored ones', () => {
    renderWithProviders(
      <ComparisonTable
        comparison={view([
          ['varna', scored(1, 1)],
          ['vashya', scored(2, 2)],
          ['nadi', indeterminate('birth-time-unknown')],
        ])}
        labelA="Asha"
        labelB="Ravi"
      />,
    );

    const total = screen.getByTestId('comparison-total');
    expect(total).toHaveAttribute('data-state', 'indeterminate');
    // 3 would be the partial sum. Printing it would be a number the engine never produced.
    expect(within(total).queryByText(/3 of/)).not.toBeInTheDocument();
    expect(within(total).getByText(/Cannot be determined/)).toBeInTheDocument();
  });

  it('shows the total when every category is scored', () => {
    renderWithProviders(
      <ComparisonTable
        comparison={view([
          ['varna', scored(1, 1)],
          ['vashya', scored(2, 2)],
        ])}
        labelA="Asha"
        labelB="Ravi"
      />,
    );

    const total = screen.getByTestId('comparison-total');
    expect(total).toHaveAttribute('data-state', 'scored');
    expect(within(total).getByText('3 of 36')).toBeInTheDocument();
  });

  it('has no axe violations with both states present', async () => {
    const { container } = renderWithProviders(
      <ComparisonTable
        comparison={view([
          ['varna', scored(1, 1)],
          ['nadi', indeterminate('birth-time-unknown')],
        ])}
        labelA="Asha"
        labelB="Ravi"
      />,
    );

    expect(await axeViolations(container)).toEqual([]);
  });
});

describe('KUN-15 comparisonAdapter — the contract is consumed in exactly one place', () => {
  it('returns contract-not-available for every input, including a well-formed-looking payload', () => {
    // api#55 has not shipped. The adapter must not guess fields, so a plausible object is refused like any other.
    const plausible = {
      pairKey: 'a|b',
      categories: [{ code: 'varna', score: 1, max: 1 }],
      total: 1,
    };

    expect(fromComparisonPayload(plausible)).toEqual(CONTRACT_NOT_AVAILABLE);
    expect(fromComparisonPayload(null)).toEqual(CONTRACT_NOT_AVAILABLE);
    expect(fromComparisonPayload(undefined)).toEqual(CONTRACT_NOT_AVAILABLE);
    expect(fromComparisonPayload('{}')).toEqual(CONTRACT_NOT_AVAILABLE);
  });

  it('states unavailability in the section rather than rendering an empty or zeroed table', () => {
    renderWithProviders(<ComparisonSection withLabels={{ a: 'Asha', b: 'Ravi' }} />);

    expect(screen.getByTestId('compare-contract-unavailable')).toBeInTheDocument();
    // The failure shapes: a table of zeros, or an empty table that reads as "nothing to compare".
    expect(screen.queryByTestId('comparison-table')).not.toBeInTheDocument();
    expect(screen.queryByText(/0 of/)).not.toBeInTheDocument();
  });

  it('comparisonTotal is null for an empty comparison and for an out-of-range score', () => {
    expect(comparisonTotal([])).toBeNull();
    // A score above its own maximum cannot be a real result; summing it would launder the defect into a total.
    expect(comparisonTotal([{ code: 'varna', score: scored(2, 1) }])).toBeNull();
    expect(comparisonTotal([{ code: 'varna', score: scored(-1, 1) }])).toBeNull();
  });

  it('isScored is a real predicate: it narrows only the scored arm', () => {
    expect(isScored(scored(1, 1))).toBe(true);
    expect(isScored(indeterminate('unknown'))).toBe(false);
  });

  it('every indeterminate reason maps to a distinct catalog key, and an unknown code falls back to the generic one', () => {
    const keys = indeterminateReasonValues.map((reason) => indeterminateReasonKey(reason));
    expect(new Set(keys).size).toBe(indeterminateReasonValues.length);
    expect(indeterminateReasonKey('not-a-real-reason')).toBe('kundali.compare.reason.unknown');
  });
});
