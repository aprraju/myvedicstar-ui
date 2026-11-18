import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { axeViolations } from '../../../test/axe';
import { renderWithProviders } from '../../../test/render';
import {
  yogasComputed,
  yogasEngineUnavailable,
  yogasPartiallyImplemented,
  yogasRuleNotImplemented,
  yogasUnknownBirthTime,
} from './fixtures';
import { YogasSection } from './YogasSection';

const zone = 'Asia/Kolkata';

describe('KUN-10 yogas — unsupported states are rendered, not omitted', () => {
  it('states rule-not-implemented with its reason code and renders no assessment list', () => {
    renderWithProviders(<YogasSection yogas={yogasRuleNotImplemented} timeZoneId={zone} />);

    expect(screen.getByText('Not available yet')).toBeInTheDocument();
    // The section-level explanation carries the reason; coverage repeats it per family, so scope to the panel.
    expect(screen.getAllByText(/the rule set for this is not implemented yet/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/rule-not-implemented/)).toBeInTheDocument();
    // No fabricated rows: no disclosure (an assessment row) and no table may exist. Family names appear only in the
    // coverage list, which states they are unavailable.
    expect(document.querySelectorAll('details')).toHaveLength(0);
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('distinguishes an engine outage from a missing rule set', () => {
    renderWithProviders(<YogasSection yogas={yogasEngineUnavailable} timeZoneId={zone} />);
    expect(screen.getAllByText(/the calculation service is not available right now/).length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText(/not implemented yet/)).not.toBeInTheDocument();
  });

  it('explains an unknown birth time as its own reason', () => {
    renderWithProviders(<YogasSection yogas={yogasUnknownBirthTime} timeZoneId={zone} />);
    expect(screen.getAllByText(/no birth time is recorded/).length).toBeGreaterThanOrEqual(1);
  });

  it('lists every owned family with its own availability in the unsupported state', () => {
    renderWithProviders(<YogasSection yogas={yogasRuleNotImplemented} timeZoneId={zone} />);

    // Even when the section itself is unavailable, coverage still names the seven families rather than showing nothing.
    const coverageTitle = screen.getByText('Assessment coverage');
    const coverage = coverageTitle.parentElement;
    expect(coverage).not.toBeNull();
    for (const family of ['Raja Yoga', 'Dhana Yoga', 'Gaja Kesari Yoga', 'Pancha Mahapurusha Yoga', 'Manglik Dosha', 'Kaal Sarp Dosha', 'Pitra Dosha']) {
      expect(within(coverage as HTMLElement).getByText(family)).toBeInTheDocument();
    }
  });
});

describe('KUN-10 yogas — evidence', () => {
  it('renders each assessment as an expandable disclosure with its conditions', async () => {
    renderWithProviders(<YogasSection yogas={yogasComputed} timeZoneId={zone} />);

    // Coverage also names the family, so target the disclosure heading specifically.
    const summary = screen.getAllByText('Gaja Kesari Yoga').find((el) => el.closest('summary') !== null)!;
    expect(summary.closest('summary')).not.toBeNull();

    const disclosure = summary.closest('details') as HTMLDetailsElement;
    // The evidence is present in the DOM whether or not the row is open.
    expect(within(disclosure).getByText('Jupiter in a kendra from the Moon')).toBeInTheDocument();
    expect(within(disclosure).getByText('Jupiter in the 4th from the Moon')).toBeInTheDocument();
    expect(within(disclosure).getByText(/Rule set yoga-2026\.1/)).toBeInTheDocument();

    // And the disclosure actually opens from the keyboard.
    const user = userEvent.setup();
    const summaryElement = summary.closest('summary') as HTMLElement;
    expect(disclosure.open).toBe(false);
    // Clicking the summary is the same code path Enter takes on a focused summary; jsdom does not emulate the browser's
    // default keyboard activation for <summary>, so this asserts the control is reachable and toggles.
    summaryElement.focus();
    expect(document.activeElement).toBe(summaryElement);
    await user.click(summaryElement);
    expect(disclosure.open).toBe(true);
  });

  it('distinguishes present, not present and cannot-be-determined in words', () => {
    renderWithProviders(<YogasSection yogas={yogasComputed} timeZoneId={zone} />);

    expect(screen.getAllByText('Present').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Cannot be determined/).length).toBeGreaterThanOrEqual(1);

    const kaalSarp = screen.getAllByText('Kaal Sarp Yoga').find((el) => el.closest('details'))!.closest('details') as HTMLElement;
    // An indeterminate row shows the unknown condition as its explanation rather than a bare verdict.
    expect(within(kaalSarp).getByText('All planets between Rahu and Ketu')).toBeInTheDocument();
  });

  it('renders exceptions and cancellations as their own categories', () => {
    renderWithProviders(<YogasSection yogas={yogasComputed} timeZoneId={zone} />);

    const manglik = screen.getAllByText('Manglik Dosha').find((el) => el.closest('details'))!.closest('details') as HTMLElement;
    expect(within(manglik).getByText('Exceptions')).toBeInTheDocument();
    expect(within(manglik).getByText('Cancellations')).toBeInTheDocument();
    expect(within(manglik).getByText(/Cancelled: Mars in its own sign/)).toBeInTheDocument();
  });

  it('says "none recorded" for an empty category instead of hiding it', () => {
    renderWithProviders(<YogasSection yogas={yogasComputed} timeZoneId={zone} />);
    const gaja = screen.getAllByText('Gaja Kesari Yoga').find((el) => el.closest('details'))!.closest('details') as HTMLElement;
    // opposing, exceptions and cancellations are all empty for this assessment; each says so explicitly.
    expect(within(gaja).getAllByText('None recorded by this rule set.').length).toBe(3);
    expect(within(gaja).getByText('Supporting placements')).toBeInTheDocument();
  });
});

describe('KUN-10 yogas — natal versus transit', () => {
  it('keeps transit findings in their own group, dated, and never as natal', () => {
    renderWithProviders(<YogasSection yogas={yogasComputed} timeZoneId={zone} />);

    const transitGroup = document.querySelector('[data-scope="transit"]') as HTMLElement;
    expect(transitGroup).not.toBeNull();
    expect(within(transitGroup).getByText(/not permanent natal findings/)).toBeInTheDocument();
    expect(within(transitGroup).getByText(/Referenced at/)).toBeInTheDocument();

    const natalGroup = document.querySelector('[data-scope="natal"]') as HTMLElement;
    expect(within(natalGroup).queryByText('Raja Yoga (transit activation)')).not.toBeInTheDocument();
  });
});

describe('KUN-10 yogas — coverage', () => {
  it('shows a partially implemented engine as some available and some explained', () => {
    renderWithProviders(<YogasSection yogas={yogasPartiallyImplemented} timeZoneId={zone} />);

    // Raja has no rule set yet in this payload.
    const coverage = screen.getByText('Assessment coverage').parentElement as HTMLElement;
    expect(within(coverage).getAllByText(/Not available: the rule set for this is not implemented yet/).length).toBeGreaterThanOrEqual(4);
    expect(within(coverage).getAllByText('Available').length).toBe(2);
  });
});

describe('KUN-10 yogas — accessibility', () => {
  it('has no axe violations in the computed state', async () => {
    const { container } = renderWithProviders(<YogasSection yogas={yogasComputed} timeZoneId={zone} />);
    expect(await axeViolations(container)).toEqual([]);
  });

  it('has no axe violations in the unsupported state', async () => {
    const { container } = renderWithProviders(<YogasSection yogas={yogasRuleNotImplemented} timeZoneId={zone} />);
    expect(await axeViolations(container)).toEqual([]);
  });

  it('renders one section heading with an accessible name', () => {
    renderWithProviders(<YogasSection yogas={yogasRuleNotImplemented} timeZoneId={zone} />);
    expect(screen.getByRole('region', { name: 'Yogas and doshas' })).toBeInTheDocument();
  });
});
