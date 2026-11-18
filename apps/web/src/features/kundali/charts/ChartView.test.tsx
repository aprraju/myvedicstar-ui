import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '../../../test/render';
import { ChartStyleSwitch } from './ChartStyleSwitch';
import { ChartView } from './ChartView';
import { chartComputed, chartNotComputed, chartUnvalidated } from './fixtures';

describe('KUN-07 charts — never a placeholder', () => {
  it('renders NO svg at all when the chart was not computed', () => {
    renderWithProviders(<ChartView response={chartNotComputed} style="north-indian" title="D9" />);

    // The whole point: an empty diamond would read as a rendering bug. Scope to the chart section - the page shell
    // has unrelated icon svgs (a close button in the location dialog) that must not be mistaken for a chart.
    const section = screen.getByRole('region', { name: 'D9' });
    expect(section.querySelector('svg')).toBeNull();
    expect(screen.getByText(/cannot be drawn yet/i)).toBeInTheDocument();
  });

  it('names the reason for the unavailable chart', () => {
    renderWithProviders(<ChartView response={chartNotComputed} style="north-indian" title="D9" />);
    expect(screen.getByText(/calculation service did not return this chart/i)).toBeInTheDocument();
  });

  it('renders no svg when the response is missing entirely', () => {
    renderWithProviders(<ChartView response={undefined} style="east-indian" title="D1" />);
    // Scoped to the chart section: the shell has unrelated icon svgs (a dialog close button).
    expect(screen.getByRole('region', { name: 'D1' }).querySelector('svg')).toBeNull();
    expect(screen.getByText(/cannot be drawn yet/i)).toBeInTheDocument();
  });

  it('renders no svg when houses are empty even if precision says computed', () => {
    // Defence in depth: a contradictory payload must not produce an empty drawing.
    renderWithProviders(
      <ChartView response={{ ...chartComputed, houses: [] }} style="south-indian" title="D9" />,
    );
    expect(screen.getByRole('region', { name: 'D9' }).querySelector('svg')).toBeNull();
  });

  it('draws the chart when the positions are present', () => {
    renderWithProviders(<ChartView response={chartComputed} style="north-indian" title="D9" />);
    expect(screen.getByTestId('chart-svg-north-indian')).toBeInTheDocument();
  });

  it('always provides a text equivalent with the same facts', () => {
    renderWithProviders(<ChartView response={chartComputed} style="south-indian" title="D9" />);
    const table = screen.getByRole('table');
    expect(table).toBeInTheDocument();
    expect(screen.getAllByRole('row')).toHaveLength(10); // header + 9 houses
    expect(screen.getByText(/Chandra at 12.4°/)).toBeInTheDocument();
  });

  it('does NOT draw an unvalidated reference, and says why', () => {
    // Positions that exist but have never been validated must not be presented as a chart: a drawn diamond implies
    // verified data. This is the strictest defensible reading of "no placeholder that reads as real data".
    renderWithProviders(<ChartView response={chartUnvalidated} style="north-indian" title="D9" />);

    const section = screen.getByRole('region', { name: 'D9' });
    expect(section.querySelector('svg')).toBeNull();
    expect(screen.getByText(/unverified reference and have not been validated/i)).toBeInTheDocument();
  });
});

describe('KUN-07 charts — style is presentation only', () => {
  function Host({ onRender }: { onRender: () => void }) {
    const [style, setStyle] = useState<'north-indian' | 'south-indian' | 'east-indian'>('north-indian');
    onRender();
    return (
      <>
        <ChartStyleSwitch style={style} onChange={setStyle} />
        <ChartView response={chartComputed} style={style} title="D9" />
      </>
    );
  }

  it('redraws in the new style without refetching or recalculating', async () => {
    const user = userEvent.setup();
    // Any API call would go through msw; an unhandled request is an error in this suite, so a passing test
    // proves no request was made by the switch.
    renderWithProviders(<Host onRender={() => undefined} />);
    expect(screen.getByTestId('chart-svg-north-indian')).toBeInTheDocument();

    await user.click(screen.getByRole('radio', { name: 'South Indian' }));

    expect(screen.getByTestId('chart-svg-south-indian')).toBeInTheDocument();
    expect(screen.queryByTestId('chart-svg-north-indian')).not.toBeInTheDocument();
    // The facts are unchanged.
    expect(screen.getByText(/Chandra at 12.4°/)).toBeInTheDocument();
  });

  it('gives the style switcher labelled radio options', () => {
    renderWithProviders(<ChartStyleSwitch style="north-indian" onChange={vi.fn()} />);
    expect(screen.getByRole('group', { name: 'Chart style' })).toBeInTheDocument();
    for (const name of ['North Indian', 'South Indian', 'East Indian']) {
      expect(screen.getByRole('radio', { name })).toBeInTheDocument();
    }
  });
});
