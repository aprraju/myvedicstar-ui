import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { axeViolations } from '../../../test/axe';
import { renderWithProviders } from '../../../test/render';
import { BalaSection } from './BalaSection';
import {
  balaAllWithheld,
  balaComplete,
  balaEmptyPlanets,
  balaWithChestaWithheld,
  balaWithoutThreshold,
} from './fixtures';

describe('KUN-12 Shadbala — a partial total is never printed as a complete one', () => {
  it('names the withheld component on the same row as the total', () => {
    renderWithProviders(<BalaSection section={balaWithChestaWithheld} />);

    const row = screen.getByTestId('shadbala-row-Sun');
    expect(within(row).getByText(/Partial total/)).toBeInTheDocument();
    expect(within(row).getByText(/Chesta is not calculated/)).toBeInTheDocument();
    expect(within(row).getByText(/not a classical required-rupas verdict/)).toBeInTheDocument();
  });

  it('puts the same caveat beside the bar value, not only in the table', () => {
    renderWithProviders(<BalaSection section={balaWithChestaWithheld} />);
    expect(screen.getByTestId('partial-Sun')).toHaveTextContent(/Chesta/);
  });

  it('does not print the caveat when the total really is complete', () => {
    renderWithProviders(<BalaSection section={balaComplete} />);
    // A permanent warning would become noise and stop meaning anything.
    expect(screen.queryByText(/Partial total/)).not.toBeInTheDocument();
    expect(screen.getByText('All six components')).toBeInTheDocument();
  });

  it('says the section is partial when the engine says so', () => {
    renderWithProviders(<BalaSection section={balaWithChestaWithheld} />);
    expect(screen.getByText(/At least one planetary total is partial/)).toBeInTheDocument();
  });
});

describe('KUN-12 Shadbala — Dig Bala is a placeholder, never a zero', () => {
  it('renders the placeholder cell as words, not as the 0 the engine sent', () => {
    renderWithProviders(<BalaSection section={balaWithChestaWithheld} />);

    const digCell = screen.getByTestId('cell-Sun-dig');
    expect(digCell).toHaveAttribute('data-state', 'placeholder');
    expect(digCell).toHaveTextContent('Not measured');
    // The decisive assertion: the numeric placeholder must not appear anywhere in that cell.
    expect(digCell.textContent).not.toMatch(/\b0\b/);
  });

  it('renders a withheld component as withheld, never as its shape value', () => {
    renderWithProviders(<BalaSection section={balaAllWithheld} />);
    const cell = screen.getByTestId('cell-Saturn-sthana');
    expect(cell).toHaveAttribute('data-state', 'withheld');
    expect(cell).toHaveTextContent('Withheld');
  });

  it('states that Dig is excluded from the total, so the number is not read as five-of-six', () => {
    renderWithProviders(<BalaSection section={balaWithChestaWithheld} />);
    const note = screen.getByTestId('excluded-Sun');
    expect(note).toHaveTextContent(/Excluded from the total/);
    expect(note).toHaveTextContent(/Dig/);
    expect(note).toHaveTextContent(/Chesta/);
  });

  it('still renders a computed component as its number', () => {
    renderWithProviders(<BalaSection section={balaWithChestaWithheld} />);
    const sthana = screen.getByTestId('cell-Sun-sthana');
    expect(sthana).toHaveAttribute('data-state', 'value');
    expect(sthana).toHaveTextContent('1.42');
  });
});

describe("KUN-12 Shadbala — the total is the engine's number", () => {
  it('shows the total as sent, not the sum of the components', () => {
    renderWithProviders(<BalaSection section={balaWithChestaWithheld} />);
    const row = screen.getByTestId('shadbala-row-Sun');
    // Components visible here sum to 3.87 in the fixture; the displayed total must be the engine's value either way,
    // and the table must not show a different number computed from the cells.
    expect(within(row).getByText(/3\.87 rupas/)).toBeInTheDocument();
  });

  it('shows no ratio when the payload has no required-rupas basis', () => {
    renderWithProviders(<BalaSection section={balaWithoutThreshold} />);
    expect(screen.queryByText(/× required/)).not.toBeInTheDocument();
    // And the list of excluded components is still stated: no ratio does not mean no caveat.
    expect(screen.getByTestId('excluded-Sun')).toBeInTheDocument();
  });

  it('renders the ratio it was given', () => {
    renderWithProviders(<BalaSection section={balaWithChestaWithheld} />);
    expect(screen.getByText(/0\.774× required/)).toBeInTheDocument();
  });
});

describe('KUN-12 Shadbala and Bhava Bala stay separate', () => {
  it('gives each its own table and never a combined total', () => {
    renderWithProviders(<BalaSection section={balaWithChestaWithheld} />);

    expect(screen.getByTestId('shadbala-table')).toBeInTheDocument();
    expect(screen.getByTestId('bhava-table')).toBeInTheDocument();

    const bhava = screen.getByTestId('bhava-table');
    // Bhava rows carry house headings, not planets, and no Shadbala planet leaks into that table.
    expect(within(bhava).getByRole('rowheader', { name: 'House 1' })).toBeInTheDocument();
    expect(within(bhava).queryByRole('rowheader', { name: 'Sun' })).not.toBeInTheDocument();
  });

  it('renders a real table with one column per component and a total', () => {
    renderWithProviders(<BalaSection section={balaWithChestaWithheld} />);
    const table = screen.getByTestId('shadbala-table');
    // planet + the five components the payload carries + total + completeness. A withheld component with no value is
    // not given a column: an empty column would invite the reader to wonder what number is missing.
    expect(within(table).getAllByRole('columnheader')).toHaveLength(8);
  });
});

describe('KUN-12 Shadbala — honest empty and accessibility states', () => {
  it('states plainly when no planets were returned', () => {
    renderWithProviders(<BalaSection section={balaEmptyPlanets} />);
    expect(screen.getByText('No planetary strength was returned.')).toBeInTheDocument();
    expect(screen.getByText('No house strength was returned.')).toBeInTheDocument();
    expect(screen.queryByTestId('shadbala-table')).not.toBeInTheDocument();
  });

  it('states the rule set and the unit', () => {
    renderWithProviders(<BalaSection section={balaWithChestaWithheld} />);
    expect(screen.getByText(/Rule set shadbala-2024\.1, values in rupas/)).toBeInTheDocument();
  });

  it('has no axe violations with a placeholder and a partial total present', async () => {
    const { container } = renderWithProviders(<BalaSection section={balaWithChestaWithheld} />);
    expect(await axeViolations(container)).toEqual([]);
  });

  it('has no axe violations in the complete state', async () => {
    const { container } = renderWithProviders(<BalaSection section={balaComplete} />);
    expect(await axeViolations(container)).toEqual([]);
  });
});
