import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { renderWithProviders } from '../../../test/render';
import {
  overviewApproximateTime,
  overviewComplete,
  overviewEngineUnavailable,
  overviewUnknownTime,
} from './fixtures';
import { OverviewPage } from './OverviewPage';

describe('KUN-05 overview — birth time modes', () => {
  it('shows the exact time as recorded', () => {
    renderWithProviders(<OverviewPage overview={overviewEngineUnavailable} />);
    expect(screen.getByTestId('birth-time')).toHaveTextContent('05:45');
  });

  it('shows an approximate time as a visible range, never a single time', () => {
    renderWithProviders(<OverviewPage overview={overviewApproximateTime} />);

    const window = screen.getByTestId('birth-time-window');
    expect(window).toHaveTextContent('14:10');
    expect(window).toHaveTextContent('15:40');
    // The uncertainty is announced, not just implied by the dashes.
    expect(window).toHaveTextContent(/Approximate/);
    // No single-time element may exist for an approximate profile.
    expect(screen.queryByTestId('birth-time')).not.toBeInTheDocument();
  });

  it('states that an unknown time was not recorded, and renders no time at all', () => {
    renderWithProviders(<OverviewPage overview={overviewUnknownTime} />);

    expect(screen.getByTestId('birth-time-unknown')).toHaveTextContent('Not recorded');
    expect(screen.queryByTestId('birth-time')).not.toBeInTheDocument();
    expect(screen.queryByTestId('birth-time-window')).not.toBeInTheDocument();
    // Explicitly guards against a sentinel or assumed time leaking in.
    expect(screen.queryByText(/00:00|12:00|sunrise/i)).not.toBeInTheDocument();
  });
});

describe('KUN-05 overview — availability comes from the payload', () => {
  it('marks every computed block unavailable on day one, with the engine reason', () => {
    renderWithProviders(<OverviewPage overview={overviewEngineUnavailable} />);

    const unavailable = screen.getAllByText('Not available');
    expect(unavailable.length).toBeGreaterThanOrEqual(4);
    expect(screen.getAllByText(/did not return this/).length).toBeGreaterThanOrEqual(4);
  });

  it('renders computed values when the engine returned them', () => {
    renderWithProviders(<OverviewPage overview={overviewComplete} />);

    expect(screen.getByText(/Vrishabha, 12\.4°/)).toBeInTheDocument();
    expect(screen.getByText('Mesha')).toBeInTheDocument();
    expect(screen.getByText(/Shani Mahadasha/)).toBeInTheDocument();
    expect(screen.queryByText('Not available')).not.toBeInTheDocument();
  });

  it('explains an unknown-time block with its own reason, not the engine reason', () => {
    renderWithProviders(<OverviewPage overview={overviewUnknownTime} />);

    // The ascendant and dasha carry 'birth-time-unknown'; blocks with no entry fall back to the engine reason, which is
    // the intended honest default, so this asserts the specific reason appears for the blocks that declared it.
    expect(screen.getAllByText(/no birth time was recorded/)).toHaveLength(2);
  });

  it('does not downgrade a block that the payload did supply', () => {
    // Approximate time leaves the ascendant unsupported but the moon sign definite.
    renderWithProviders(<OverviewPage overview={overviewApproximateTime} />);

    expect(screen.getByText('Karka')).toBeInTheDocument();
    expect(screen.getAllByText(/only approximate/).length).toBeGreaterThanOrEqual(1);
  });

  it('still shows unavailable when a block is absent with no matching unsupported entry', () => {
    // Honest default: absence without an explanation is not silently omitted and never invented.
    const { unsupported: _dropped, ...rest } = overviewEngineUnavailable;
    renderWithProviders(<OverviewPage overview={{ ...rest, unsupported: [] }} />);

    expect(screen.getAllByText('Not available').length).toBeGreaterThanOrEqual(4);
    expect(screen.getAllByText(/did not return this/).length).toBeGreaterThanOrEqual(4);
  });
});

describe('KUN-05 overview — birth details parity', () => {
  it('shows name, date, place, coordinates and timezone from the payload', () => {
    renderWithProviders(<OverviewPage overview={overviewEngineUnavailable} />);

    expect(screen.getByText('Asha')).toBeInTheDocument();
    expect(screen.getByText('Hyderabad, Telangana, India')).toBeInTheDocument();
    expect(screen.getByText('17.385, 78.4867')).toBeInTheDocument();
    expect(screen.getByText('Asia/Kolkata')).toBeInTheDocument();
    // formatLocalDate defaults to a weekday+month+day form, so assert on the day and month rather than guessing a style.
    expect(screen.getByText(/April 12/)).toBeInTheDocument();
  });

  it('keeps full coordinate precision instead of number-formatting it', () => {
    renderWithProviders(<OverviewPage overview={overviewEngineUnavailable} />);
    // The translator number-formats numeric params, which rounded 78.4867 to 78.487. Coordinates are identifiers.
    expect(screen.getByText('17.385, 78.4867')).toBeInTheDocument();
  });

  it('states the conventions the result was produced with', () => {
    renderWithProviders(<OverviewPage overview={overviewComplete} />);
    expect(screen.getByText(/swisseph 2\.10\.03, Lahiri ayanamsa, Placidus houses/)).toBeInTheDocument();
  });
});

describe('KUN-05 overview — scope boundaries', () => {
  it('has no export, PDF or share control anywhere', () => {
    renderWithProviders(<OverviewPage overview={overviewComplete} />);

    // Save as PDF lives only in Reports; the overview must not offer it.
    expect(screen.queryByRole('button', { name: /pdf|export|share|download/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /pdf|export|share|download/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/Save as PDF|Export|Share/i)).not.toBeInTheDocument();
  });

  it('renders a single h1 and labelled sections', () => {
    const { container } = renderWithProviders(<OverviewPage overview={overviewComplete} />);

    expect(container.querySelectorAll('h1')).toHaveLength(1);
    const birth = screen.getByRole('region', { name: 'Birth details' });
    expect(within(birth).getByText('Name')).toBeInTheDocument();
  });
});
