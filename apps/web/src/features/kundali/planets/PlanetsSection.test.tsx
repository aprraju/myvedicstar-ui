import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { renderWithProviders } from '../../../test/render';
import {
  planetsApproximateTime,
  planetsEmpty,
  planetsEnginePartial,
  planetsPadaMissing,
  planetsUnexplainedGap,
  planetsUnknownTime,
} from './fixtures';
import { PlanetsSection } from './PlanetsSection';

/**
 * Every fact-bearing cell of a row, for asserting that none of them is a dash or a blank.
 *
 * The graha name is the row header (`<th scope="row">`), not a cell, so it is included explicitly: a row whose name were
 * missing would be just as broken as one whose facts were.
 */
function cellsOf(row: HTMLElement): string[] {
  return [within(row).getByRole('rowheader'), ...within(row).getAllByRole('cell')].map((cell) =>
    (cell.textContent ?? '').trim(),
  );
}

describe('KUN-08 planetary detail — the unsupported path is first class', () => {
  it('lists all nine grahas even when only the sun and moon computed', () => {
    renderWithProviders(<PlanetsSection section={planetsEnginePartial} />);

    // Suppressing a planet would make the chart read as having fewer grahas than it does.
    for (const name of ['Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn', 'Rahu', 'Ketu']) {
      expect(screen.getByRole('rowheader', { name })).toBeInTheDocument();
    }
  });

  it('explains every unavailable cell instead of printing a dash, a zero or a blank', () => {
    renderWithProviders(<PlanetsSection section={planetsEnginePartial} />);

    const mars = screen.getByTestId('planet-row-mars');
    const cells = cellsOf(mars);
    expect(cells.length).toBe(10);
    // The first entry is the graha name, which is a label rather than a computed fact.
    expect(cells[0]).toBe('Mars');
    for (const text of cells.slice(1)) {
      expect(text).not.toBe('');
      // A dash or an en dash as a whole cell is exactly the placeholder this section forbids.
      expect(text).not.toMatch(/^[-–—]$/);
      expect(text).toMatch(/Not available/);
      expect(text).toMatch(/did not return this/);
    }
  });

  it('never renders a bare 0 in place of an uncomputed degree or house', () => {
    renderWithProviders(<PlanetsSection section={planetsEnginePartial} />);

    const saturn = screen.getByTestId('planet-row-saturn');
    expect(within(saturn).queryByText(/^0$/)).not.toBeInTheDocument();
    expect(within(saturn).queryByText(/0°/)).not.toBeInTheDocument();
    expect(within(saturn).queryByText(/House 0/)).not.toBeInTheDocument();
  });

  it('names the house and aspect methods, as AC2 requires', () => {
    renderWithProviders(<PlanetsSection section={planetsEnginePartial} />);

    const methods = screen.getByTestId('planet-methods');
    expect(methods).toHaveTextContent('whole-sign');
    expect(methods).toHaveTextContent('parashari-full-partial');
  });

  it('states the calculation provenance when the payload carries it', () => {
    renderWithProviders(<PlanetsSection section={planetsEnginePartial} />);

    const conventions = screen.getByTestId('planet-conventions');
    expect(conventions).toHaveTextContent('Lahiri');
    expect(conventions).toHaveTextContent('parashara');
    expect(conventions).toHaveTextContent('standard');
  });
});

describe('KUN-08 planetary detail — computed facts render as computed', () => {
  it('renders sign, degree, nakshatra with pada, house, dignity and flags for a full row', () => {
    renderWithProviders(<PlanetsSection section={planetsEnginePartial} />);

    const sun = screen.getByTestId('planet-row-sun');
    expect(within(sun).getByText('Mesha')).toBeInTheDocument();
    expect(within(sun).getByText('18.42°')).toBeInTheDocument();
    expect(within(sun).getByText('Bharani, pada 3')).toBeInTheDocument();
    expect(within(sun).getByText('House 12')).toBeInTheDocument();
    expect(within(sun).getByText('Exalted')).toBeInTheDocument();
    // A computed false is a real answer, so it is stated rather than left blank.
    // The sun fixture reports retrograde true; a computed false is covered by the moon row in this same fixture.
    expect(within(sun).getByText('Not combust')).toBeInTheDocument();
    expect(within(sun).getByText('Retrograde')).toBeInTheDocument();
    expect(within(screen.getByTestId('planet-row-moon')).getByText('Direct')).toBeInTheDocument();
  });

  it('renders aspects with an orb when the engine measured one, and without inventing 0° when it did not', () => {
    renderWithProviders(<PlanetsSection section={planetsEnginePartial} />);

    const sun = screen.getByTestId('planet-row-sun');
    expect(within(sun).getByText('Full aspect to Moon (orb 4.2°)')).toBeInTheDocument();
    expect(within(sun).getByText('Opposition aspect to Saturn')).toBeInTheDocument();
    expect(within(sun).queryByText(/Saturn \(orb 0/)).not.toBeInTheDocument();
  });

  it('distinguishes a computed empty relationship set from a relationship set the engine did not return', () => {
    renderWithProviders(<PlanetsSection section={planetsEnginePartial} />);

    // Sun has relationships, Moon has one, and Mars has none returned at all: the Mars cell is unavailable, not "None".
    expect(within(screen.getByTestId('planet-row-sun')).getByText('Friendly')).toBeInTheDocument();
    expect(within(screen.getByTestId('planet-row-mars')).queryByText('None')).not.toBeInTheDocument();
  });
});

describe('KUN-08 planetary detail — birth-time precision', () => {
  it('suppresses the house for an unknown birth time with that specific reason', () => {
    renderWithProviders(<PlanetsSection section={planetsUnknownTime} />);

    const sun = screen.getByTestId('planet-row-sun');
    expect(within(sun).getByText('Mesha')).toBeInTheDocument();
    expect(within(sun).getByText(/no birth time was recorded/)).toBeInTheDocument();
    expect(within(sun).queryByText(/House \d/)).not.toBeInTheDocument();
  });

  it('qualifies a house computed from an approximate time rather than presenting it as exact', () => {
    renderWithProviders(<PlanetsSection section={planetsApproximateTime} />);

    const moon = screen.getByTestId('planet-row-moon');
    // Both the degree and the house are approximate, so both carry the reason; neither may be shown as exact.
    expect(within(moon).getAllByText(/only approximate/)).toHaveLength(2);
    expect(within(moon).queryByText(/House \d/)).not.toBeInTheDocument();
    expect(within(moon).queryByText(/\d+(\.\d+)?°/)).not.toBeInTheDocument();
  });

  it('shows a nakshatra whose pada is missing as partial, not as a complete value', () => {
    renderWithProviders(<PlanetsSection section={planetsPadaMissing} />);

    const venus = screen.getByTestId('planet-row-venus');
    expect(venus.textContent).toContain('Swati');
    // The pada is stated as unavailable with its own reason, so the nakshatra is not read as a complete answer.
    expect(venus.textContent).toMatch(/pada not available/);
    expect(venus.textContent).toMatch(/did not return this/);
  });
});

describe('KUN-08 planetary detail — honest defaults and boundaries', () => {
  it('treats a fact that is missing with no explanation as unavailable, never as blank', () => {
    renderWithProviders(<PlanetsSection section={planetsUnexplainedGap} />);

    const cells = cellsOf(screen.getByTestId('planet-row-jupiter'));
    expect(cells[0]).toBe('Jupiter');
    for (const text of cells.slice(1)) {
      expect(text).not.toBe('');
      expect(text).toMatch(/Not available/);
    }
  });

  it('states that no planets were returned rather than showing an empty table', () => {
    renderWithProviders(<PlanetsSection section={planetsEmpty} />);

    expect(screen.getByTestId('planets-empty')).toHaveTextContent(/No planets were returned for this chart/);
    expect(screen.getByTestId('planets-empty')).toHaveTextContent(/did not return this/);
    expect(screen.queryByTestId('planets-table')).not.toBeInTheDocument();
  });

  it('never renders chart artwork, because positions are the precondition for drawing one', () => {
    const { container } = renderWithProviders(<PlanetsSection section={planetsEnginePartial} />);

    // Scoped to this section: the app shell may legitimately draw its own icons around it.
    const sectionEl = container.querySelector('[aria-labelledby="kundali-planets-heading"]');
    expect(sectionEl).not.toBeNull();
    expect(sectionEl?.querySelector('svg, canvas, img')).toBeNull();
  });
});

describe('KUN-08 planetary detail — structure and accessibility', () => {
  it('is a labelled region with a real table, caption and column headers', () => {
    renderWithProviders(<PlanetsSection section={planetsEnginePartial} />);

    const region = screen.getByRole('region', { name: 'Planetary detail' });
    const table = within(region).getByTestId('planets-table');
    expect(table.tagName).toBe('TABLE');
    expect(within(region).getByRole('columnheader', { name: 'Dignity' })).toBeInTheDocument();
    expect(within(region).getByRole('rowheader', { name: 'Sun' })).toBeInTheDocument();
  });

  it('associates each unavailable cell with the fact it belongs to for screen readers', () => {
    renderWithProviders(<PlanetsSection section={planetsEnginePartial} />);

    const mars = screen.getByTestId('planet-row-mars');
    // The column name is announced after the reason, so a reader hears which fact is missing, not just "not available".
    expect(within(mars).getByText(/— Dignity/)).toBeInTheDocument();
  });

  it('makes the scrolling table wrapper keyboard focusable', () => {
    renderWithProviders(<PlanetsSection section={planetsEnginePartial} />);

    const scrollRegion = screen.getByRole('region', { name: /scrollable horizontally/i });
    expect(scrollRegion).toHaveAttribute('tabindex', '0');
  });
});
