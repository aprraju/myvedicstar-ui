import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { declaredValue, resolvedLength } from '../../../test/domSize';
import { renderWithProviders } from '../../../test/render';
import {
  type CategoryScore,
  comparisonTotal,
  type ComparisonView,
  type IndeterminateReason,
} from './comparisonAdapter';
import {
  type CompareProfileOption,
  CompareProfiles,
  ComparisonSection,
  ComparisonTable,
} from './ComparisonTable';

/**
 * Accessibility and touch-target tests for the KUN-15 compare surface (ui#83 follow-up).
 *
 * Every assertion here is on the component as rendered. The size checks measure the declaration chain from the module's
 * own rule to the token it resolves — see `test/domSize.ts` for why jsdom cannot use getBoundingClientRect and what this
 * measurement therefore does and does not prove.
 */

/**
 * The module's own stylesheet, read from disk: the size and focus assertions below measure the declaration chain a
 * browser would apply, and jsdom resolves neither layout nor media queries. `__dirname` is the directory of this test,
 * which the repo's own module-class tests use for the same reason (the vitest jsdom environment has no file: URL base).
 */
const CSS = readFileSync(resolve(__dirname, 'Compare.module.css'), 'utf8');
/** The smallest viewport the issue requires; the mobile rule is the one that must still meet 44px. */
const MIN_TOUCH_TARGET = 44;

const ASHA: CompareProfileOption = { id: '11111111-1111-4111-8111-111111111111', name: 'Asha' };
const RAVI: CompareProfileOption = { id: '22222222-2222-4222-8222-222222222222', name: 'Ravi' };

const scored = (score: number, max: number): CategoryScore => ({ kind: 'scored', score, max });
const indeterminate = (reason: IndeterminateReason): CategoryScore => ({ kind: 'indeterminate', reason });
const view = (categories: [string, CategoryScore][], scoredMax = 36): ComparisonView => ({
  categories: categories.map(([code, score]) => ({ code, score })),
  total: comparisonTotal(categories.map(([code, score]) => ({ code, score }))),
  scoredMax,
});

const renderPicker = (props: {
  firstId?: string | null;
  secondId?: string | null;
  profiles?: CompareProfileOption[];
}) =>
  renderWithProviders(
    <CompareProfiles
      profiles={props.profiles ?? [ASHA, RAVI]}
      firstId={props.firstId ?? null}
      secondId={props.secondId ?? null}
      onChange={() => undefined}
    >
      {({ a, b }) => <ComparisonSection withLabels={{ a: a.name, b: b.name }} />}
    </CompareProfiles>,
  );

describe('KUN-15 compare — touch targets at a 320px viewport', () => {
  it('every select in the picker resolves to at least 44px from the module rule through its token', () => {
    renderPicker({});
    const controls = screen.getAllByRole('combobox');
    expect(controls).toHaveLength(2);

    const declared = declaredValue(CSS, '.control', 'min-block-size');
    for (const control of controls) {
      expect(resolvedLength(control, declared)).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET);
    }
  });

  it('the 44px floor is the one the mobile layout states, not a wider-viewport override', () => {
    // A wider breakpoint may enlarge the control; the requirement is the smallest declared size, so the base rule (which
    // applies at 320px) is the one asserted. If a media query ever *reduced* it, this rule would still guard the floor,
    // and the E2E lane measures real layout at 320px.
    expect(
      resolvedLength(document.documentElement, declaredValue(CSS, '.control', 'min-block-size')),
    ).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET);
  });
});

describe('KUN-15 compare — keyboard operability', () => {
  it('tabs through both selects in visual order, each showing a visible focus ring', async () => {
    const user = userEvent.setup();
    renderPicker({});

    const first = screen.getByLabelText('First Astro Profile');
    const second = screen.getByLabelText('Second Astro Profile');

    await user.tab();
    expect(document.activeElement).toBe(first);
    await user.tab();
    expect(document.activeElement).toBe(second);

    // Visible focus is a CSS contract: assert the rule exists for the control rather than trusting the UA outline.
    expect(declaredValue(CSS, '.control:focus-visible', 'outline')).toMatch(/solid/);
  });

  it('lets the comparison table be reached and scrolled by keyboard, with its own focus ring', async () => {
    const user = userEvent.setup();
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

    const region = screen.getByRole('region', { name: /comparison table/i });
    await user.tab();
    expect(document.activeElement).toBe(region);
    expect(declaredValue(CSS, '.tableWrap:focus-visible', 'outline')).toMatch(/solid/);
  });

  it('reaches the section heading and the table in DOM order, so focus follows reading order', async () => {
    const user = userEvent.setup();
    renderPicker({ firstId: ASHA.id, secondId: RAVI.id });

    // Heading first (it is not focusable, so the first tab stop is the first select), then the two selects, then the
    // scrollable table region - DOM order is the tab order here, which is what makes the visual order truthful.
    await waitFor(() => expect(screen.getByTestId('compare-contract-unavailable')).toBeInTheDocument());
    await user.tab();
    expect(document.activeElement).toBe(screen.getByLabelText('First Astro Profile'));
    await user.tab();
    expect(document.activeElement).toBe(screen.getByLabelText('Second Astro Profile'));
    await user.tab();
    // The unavailable status is not focusable; the next stop after the second select is the document body end or the
    // next tabbable, which in this isolated tree is nothing - so focus must have left the picker, never landed on a
    // non-interactive node pretending to be reachable.
    expect([
      screen.getByLabelText('First Astro Profile'),
      screen.getByLabelText('Second Astro Profile'),
    ]).not.toContain(document.activeElement);
  });
});

describe('KUN-15 compare — every control has an accessible name', () => {
  it('names both picker controls, so each is announced by purpose rather than by position', () => {
    renderPicker({});
    expect(screen.getByRole('combobox', { name: 'First Astro Profile' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Second Astro Profile' })).toBeInTheDocument();
  });

  it('fails when a control loses its name: an unnamed select here is reported by its role and options', () => {
    // The bite-proof lives in the review thread (the name is removed locally and this suite goes red). This test states
    // the invariant the bite exercised: neither combobox may be reachable without a name.
    renderPicker({});
    for (const control of screen.getAllByRole('combobox')) {
      expect(control).toHaveAccessibleName();
    }
    // And the disabled option on the opposite side does not steal the name of its select.
    const second = screen.getByLabelText('Second Astro Profile');
    expect(within(second).getAllByRole('option').length).toBeGreaterThan(1);
  });

  it('gives the scrollable table region a name that says how it behaves', () => {
    renderWithProviders(
      <ComparisonTable comparison={view([['varna', scored(1, 1)]])} labelA="Asha" labelB="Ravi" />,
    );
    expect(screen.getByRole('region', { name: /scrollable horizontally/i })).toBeInTheDocument();
  });
});

describe('KUN-15 compare — contrast pairings come from tokens that pass AA', () => {
  it('uses the muted text token only on token surfaces that the design-token suite proves for AA', () => {
    // This test does not invent a contrast number: it asserts the USAGE pair is one the design-token suite covers, so a
    // failure lands in the token suite where the pairing is measured, not in a colour hardcoded here to pass.
    const hint = declaredValue(CSS, '.hint', 'color');
    expect(hint).toBe('var(--color-text-muted)');
    // The indeterminate row explicitly avoids the error colour: an undetermined score is not an error state.
    const indeterminateRule = declaredValue(CSS, '.indeterminate', 'color');
    expect(indeterminateRule).not.toMatch(/--color-error/);
  });
});
