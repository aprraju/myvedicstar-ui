import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { renderWithProviders } from '../../../test/render';
import { REPORT_CONTRACT_GAPS, reportAvailability } from './reportAvailability';
import { ReportsPanel } from './ReportsPanel';

describe('KUN-17 reports — honest states', () => {
  it('states that PDF generation is not available, and why', () => {
    renderWithProviders(<ReportsPanel profileName="Asha" />);

    expect(screen.getByRole('heading', { name: /not available yet/i })).toBeInTheDocument();
    // The reason comes from the shared vocabulary, not reports-specific prose invented for this panel.
    expect(screen.getByText(/did not return this/i)).toBeInTheDocument();
  });

  it('never renders a download control, disabled or otherwise', () => {
    renderWithProviders(<ReportsPanel profileName="Asha" />);

    // A disabled button with no explanation is silent degradation: the user cannot tell whether it failed, whether
    // they lack permission, or whether it does not exist. The panel must not offer one at all.
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /download|pdf/i })).not.toBeInTheDocument();
  });

  it('lists every outstanding contract gap so the absence is attributable', () => {
    renderWithProviders(<ReportsPanel profileName="Asha" />);

    const gapItems = screen.getAllByRole('listitem');
    expect(gapItems).toHaveLength(REPORT_CONTRACT_GAPS.length);
    expect(screen.getByText(/report generation request is not built/i)).toBeInTheDocument();
    expect(screen.getByText(/no download link can be issued/i)).toBeInTheDocument();
  });

  it('offers the short/detailed choice, because the contract fixes it', () => {
    renderWithProviders(<ReportsPanel profileName="Asha" />);

    expect(screen.getByRole('group', { name: /report length/i })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Short' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Detailed' })).toBeInTheDocument();
  });

  it('keeps the variant choice enabled while the action is unavailable', () => {
    renderWithProviders(<ReportsPanel profileName="Asha" />);
    // Choosing a length is meaningful even before generation exists; only the action is blocked.
    expect(screen.getByRole('radio', { name: 'Detailed' })).toBeEnabled();
  });
});

describe('KUN-17 report availability', () => {
  it('reports unavailable with the shared engine reason', () => {
    const availability = reportAvailability();
    expect(availability.available).toBe(false);
    expect(availability.reason).toBe('engine-unavailable');
  });

  it('names all three missing endpoints, not a subset', () => {
    expect(reportAvailability().gaps).toEqual([
      'endpoint-post-reports',
      'endpoint-get-report-status',
      'download-url',
    ]);
  });
});
