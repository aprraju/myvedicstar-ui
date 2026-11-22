import { en } from '@myvedicstar/localization';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { axeViolations } from '../../../test/axe';
import { renderWithProviders } from '../../../test/render';
import { remediesAllSuppressed, remediesEvaluated, remediesMixed, remediesNoneApply } from './fixtures';
import { RemediesSection } from './RemediesSection';

async function open() {
  await userEvent.click(screen.getByRole('button', { name: /show remedies/i }));
}

/**
 * Guard, not a substitute for rendering.
 *
 * The catalog is consumed as an English fallback at runtime; a missing `remedies` block does not fail typecheck and
 * does not fail a render — the translator returns the key itself, and every assertion below would quietly have to match
 * `kundali.remedies.show` instead of words. That already happened once during this change, and the failure looked like
 * a broken locator rather than a missing translation. This assertion is the one that names the real cause.
 */
describe('KUN-16 remedies catalog', () => {
  it('carries a remedies block with every key the section reads', () => {
    const remedies = (en as { kundali: Record<string, unknown> }).kundali.remedies as Record<string, unknown>;
    expect(remedies).toBeDefined();
    for (const key of [
      'title',
      'intro',
      'show',
      'hide',
      'catalogVersion',
      'finding',
      'category',
      'tradition',
      'reference',
      'noneApply',
      'noneForFindings',
      'suppressedTitle',
      'suppressedNote',
      'suppressedItem',
      'unsupportedTitle',
      'unsupportedItem',
      'disclaimer',
      'status',
    ]) {
      expect(remedies[key], `kundali.remedies.${key}`).toBeDefined();
    }
  });
});

describe('KUN-16 remedies — only an evaluated finding may carry a remedy', () => {
  it('starts collapsed: the list is not in the document until the disclosure is opened', () => {
    renderWithProviders(<RemediesSection section={remediesEvaluated} />);

    expect(screen.queryByTestId('remedies-body')).not.toBeInTheDocument();
    const toggle = screen.getByRole('button', { name: /show remedies/i });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
  });

  it('attached: renders the evaluated remedies with tradition and source beside them', async () => {
    renderWithProviders(<RemediesSection section={remediesEvaluated} />);
    await open();

    const list = screen.getByTestId('remedies-list');
    expect(within(list).getAllByRole('listitem')).toHaveLength(2);

    const gaja = screen.getByTestId('remedy-yoga:gaja-kesari');
    expect(within(gaja).getByText('yoga:gaja-kesari')).toBeInTheDocument();
    // A remedy with no attributed tradition or source is an assertion the product cannot stand behind.
    expect(within(gaja).getByText('Smarta')).toBeInTheDocument();
    expect(within(gaja).getByText(/temple observance notes/i)).toBeInTheDocument();
    expect(screen.getByText(/Remedy catalogue 2026-11-01/)).toBeInTheDocument();
  });

  it('not-evaluated: a remedy whose finding the engine could not assess is reported, never rendered', async () => {
    renderWithProviders(<RemediesSection section={remediesMixed} />);
    await open();

    expect(screen.queryByTestId('remedy-dosha:mangal')).not.toBeInTheDocument();

    const suppressed = screen.getByTestId('remedies-suppressed');
    expect(within(suppressed).getByText(/dosha:mangal/)).toBeInTheDocument();
    expect(within(suppressed).getByText(/Not evaluated — an input was missing/)).toBeInTheDocument();
  });

  it('withheld: a capability-gap finding cannot promote its remedy into the list', async () => {
    renderWithProviders(<RemediesSection section={remediesMixed} />);
    await open();

    expect(screen.queryByTestId('remedy-dosha:kaal-sarp')).not.toBeInTheDocument();
    const suppressed = screen.getByTestId('remedies-suppressed');
    expect(within(suppressed).getByText(/dosha:kaal-sarp/)).toBeInTheDocument();
    expect(within(suppressed).getByText(/Withheld — a capability gap/)).toBeInTheDocument();
  });

  it('unknown-code: an unrecognised status resolves to unknown-code and is not rendered', async () => {
    renderWithProviders(<RemediesSection section={remediesMixed} />);
    await open();

    // The fixture's wire text is a status this build has no vocabulary for. The failure this guards against is a
    // client that treats an unreadable status as permission - rendering it, or assuming "evaluated".
    expect(screen.queryByTestId('remedy-yoga:future-vocabulary')).not.toBeInTheDocument();

    const suppressed = screen.getByTestId('remedies-suppressed');
    expect(within(suppressed).getByText(/yoga:future-vocabulary/)).toBeInTheDocument();
    expect(
      within(suppressed).getByText(/Unrecognised status — the catalogue may have changed/),
    ).toBeInTheDocument();
  });

  it('renders exactly the evaluated subset when all four statuses arrive together', async () => {
    renderWithProviders(<RemediesSection section={remediesMixed} />);
    await open();

    const list = screen.getByTestId('remedies-list');
    // One of four items may render. The number is asserted, not the ordering: a filter that let one more through would
    // still show the right first item.
    expect(within(list).getAllByRole('listitem')).toHaveLength(1);
    expect(within(list).getByText('yoga:gaja-kesari')).toBeInTheDocument();
  });

  it('reports server-supplied unsupported entries with their reason', async () => {
    renderWithProviders(<RemediesSection section={remediesMixed} />);
    await open();

    const unsupported = screen.getByTestId('remedies-unsupported');
    expect(within(unsupported).getByText(/input-missing/)).toBeInTheDocument();
    expect(within(unsupported).getByText(/capability-gap/)).toBeInTheDocument();
    expect(within(unsupported).getByText(/catalogue-stale/)).toBeInTheDocument();
  });

  it('empty and nothing withheld is stated as a real answer, not as a loading or error state', async () => {
    renderWithProviders(<RemediesSection section={remediesNoneApply} />);
    await open();

    expect(screen.getByTestId('remedies-empty')).toHaveTextContent(/No traditional remedy applies/i);
    expect(screen.queryByTestId('remedies-list')).not.toBeInTheDocument();
    expect(screen.queryByTestId('remedies-suppressed')).not.toBeInTheDocument();
  });

  it('only suppressed items: no list, and the section still explains why', async () => {
    renderWithProviders(<RemediesSection section={remediesAllSuppressed} />);
    await open();

    expect(screen.queryByTestId('remedies-list')).not.toBeInTheDocument();
    expect(screen.queryByTestId('remedies-empty')).not.toBeInTheDocument();
    expect(screen.getByTestId('remedies-suppressed')).toBeInTheDocument();
    expect(screen.getByText(/No remedy is available for the findings/i)).toBeInTheDocument();
  });

  it('states the optional-practice disclaimer, so no suggestion reads as a prescription', async () => {
    renderWithProviders(<RemediesSection section={remediesEvaluated} />);
    await open();

    expect(screen.getByText(/treats, cures or guarantees any outcome/i)).toBeInTheDocument();
  });

  it('keyboard: the disclosure is operable by keyboard and announces its expanded state', async () => {
    renderWithProviders(<RemediesSection section={remediesEvaluated} />);

    const toggle = screen.getByRole('button', { name: /show remedies/i });
    toggle.focus();
    expect(toggle).toHaveFocus();

    await userEvent.keyboard('{Enter}');
    expect(screen.getByRole('button', { name: /hide remedies/i })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByTestId('remedies-body')).toBeInTheDocument();

    await userEvent.keyboard('{Enter}');
    expect(screen.queryByTestId('remedies-body')).not.toBeInTheDocument();
  });

  it('has no axe violations in the expanded state', async () => {
    const { container } = renderWithProviders(<RemediesSection section={remediesMixed} />);
    await open();

    expect(await axeViolations(container)).toEqual([]);
  });
});
