import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { axeViolations } from '../../../test/axe';
import { renderWithProviders } from '../../../test/render';
import { AshtakavargaSection } from './AshtakavargaSection';
import {
  ashtakavargaComputed,
  ashtakavargaEngineUnavailable,
  ashtakavargaRuleNotImplemented,
} from './fixtures';

describe('KUN-11 ashtakavarga — unsupported states', () => {
  it('states the reason code and renders no table at all', () => {
    renderWithProviders(<AshtakavargaSection ashtakavarga={ashtakavargaRuleNotImplemented} />);

    expect(screen.getByText('Not available yet')).toBeInTheDocument();
    expect(screen.getByText(/the rule set for this is not implemented yet/)).toBeInTheDocument();
    // The crucial guarantee: an unsupported section has no chart and no table, so no zero-filled grid can appear.
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.queryByRole('figure')).not.toBeInTheDocument();
  });

  it('distinguishes an engine outage', () => {
    renderWithProviders(<AshtakavargaSection ashtakavarga={ashtakavargaEngineUnavailable} />);
    expect(screen.getByText(/the calculation service is not available right now/)).toBeInTheDocument();
  });
});

describe('KUN-11 ashtakavarga — accessible values', () => {
  it('renders a real table with row and column headers and the same numbers as the response', () => {
    renderWithProviders(<AshtakavargaSection ashtakavarga={ashtakavargaComputed} />);

    const table = screen.getByRole('table', { name: /Ashtakavarga bindus by planet and sign/ });
    // Column headers: twelve signs plus the planet and total headers.
    expect(within(table).getAllByRole('columnheader').length).toBe(14);
    // Row headers: seven planets plus the Sarva row.
    expect(within(table).getAllByRole('rowheader').length).toBe(8);

    const sunRow = within(table).getByRole('rowheader', { name: 'Sun' }).closest('tr') as HTMLElement;
    const cells = within(sunRow).getAllByRole('cell');
    expect(cells).toHaveLength(13);
    expect(cells[0]).toHaveTextContent('3');
    expect(cells[11]).toHaveTextContent('2');
    expect(cells[12]).toHaveTextContent('60');
  });

  it('reports the sarva row and grand total from the payload, not from client arithmetic', () => {
    renderWithProviders(<AshtakavargaSection ashtakavarga={ashtakavargaComputed} />);

    const table = screen.getByRole('table');
    const sarvaRow = within(table).getByRole('rowheader', { name: 'Sarva' }).closest('tr') as HTMLElement;
    const cells = within(sarvaRow).getAllByRole('cell');
    expect(cells[0]).toHaveTextContent('18');
    expect(cells[9]).toHaveTextContent('31');
    expect(cells[12]).toHaveTextContent('335');
  });

  it('states the methodology, rule version and legend', () => {
    renderWithProviders(<AshtakavargaSection ashtakavarga={ashtakavargaComputed} />);

    expect(screen.getByText('Sarvashtakavarga')).toBeInTheDocument();
    expect(screen.getAllByText('ashtakavarga-2026.1').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/28 or more bindus is considered strong/)).toBeInTheDocument();
    expect(screen.getByText(/Aries, Scorpio, Pisces/)).toBeInTheDocument();
  });

  it('marks the heat map aria-hidden so screen readers get the table, not a second rendering', () => {
    renderWithProviders(<AshtakavargaSection ashtakavarga={ashtakavargaComputed} />);
    const figure = screen.getByRole('figure');
    const grid = figure.querySelector('[aria-hidden="true"]');
    expect(grid).not.toBeNull();
    // The visible caption explains the relationship.
    expect(within(figure).getByText(/The same values are listed in the table below/)).toBeInTheDocument();
  });

  it('has no axe violations', async () => {
    const { container } = renderWithProviders(<AshtakavargaSection ashtakavarga={ashtakavargaComputed} />);
    expect(await axeViolations(container)).toEqual([]);
  });

  it('has no axe violations in the unsupported state', async () => {
    const { container } = renderWithProviders(<AshtakavargaSection ashtakavarga={ashtakavargaRuleNotImplemented} />);
    expect(await axeViolations(container)).toEqual([]);
  });
});
