import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { I18nProvider } from '../../../shared/i18n/I18nProvider';
import { InterpretationsPanel } from './InterpretationsPanel';
import type { InterpretationsResponse } from './sections';
import { toDomainViews } from './sections';

function renderPanel(response: InterpretationsResponse | null = null) {
  return render(
    <I18nProvider>
      <InterpretationsPanel profileName="Asha" response={response} />
    </I18nProvider>,
  );
}

/**
 * Only the per-domain regions carry \`data-domain\`. The panel's own outer \`<section>\` is also a region (it has an
 * accessible name), so an unscoped \`getAllByRole('region')\` counts it too and reports a leading \`null\`. Scoping here
 * keeps the assertions about the domains rather than about how many landmarks happen to wrap them.
 */
function domainRegions() {
  return screen.getAllByRole('region').filter((region) => region.hasAttribute('data-domain'));
}

/** A full response where every domain is ready, for use as the "both rows agree" baseline of divergence tests. */
function allReady(): InterpretationsResponse {
  return {
    sourceRevision: 'rev-1',
    sections: [
      { domain: 'career', status: 'ready', text: 'Career reading text.', factors: ['dasha.mahadasha.lord'] },
      { domain: 'marriage', status: 'ready', text: 'Marriage reading text.', factors: ['house.7.lord'] },
      { domain: 'wellbeing', status: 'ready', text: 'Wellbeing reading text.', factors: ['moon.dignity'] },
      { domain: 'finance', status: 'ready', text: 'Finance reading text.', factors: ['house.2.lord'] },
      { domain: 'education', status: 'ready', text: 'Education reading text.', factors: ['house.4.lord'] },
    ],
  };
}

describe('InterpretationsPanel', () => {
  it('shows the traditional-interpretation label regardless of what the server returns', () => {
    renderPanel(null);
    expect(screen.getByText(/not predictions, and nothing here is guaranteed/i)).toBeInTheDocument();
  });

  it('renders a reading and its evidence for a ready domain', () => {
    const response: InterpretationsResponse = {
      sourceRevision: 'rev-1',
      sections: [
        {
          domain: 'career',
          status: 'ready',
          text: 'Career reading text.',
          factors: ['dasha.mahadasha.lord'],
        },
      ],
    };
    renderPanel(response);

    const career = screen.getByRole('region', { name: 'Career' });
    expect(within(career).getByText('Career reading text.')).toBeInTheDocument();
    expect(within(career).getByText('dasha.mahadasha.lord')).toBeInTheDocument();
  });

  /*
   * The rule the architect singled out: pending is not failed, and a collapsed implementation must fail this test.
   * Asserting only that some sentence is present would pass for an implementation that renders one shared message.
   */
  it('renders pending differently from failed', () => {
    const response: InterpretationsResponse = {
      sourceRevision: 'rev-1',
      sections: [
        { domain: 'career', status: 'pending', text: null, factors: [] },
        { domain: 'finance', status: 'failed', text: null, factors: [] },
      ],
    };
    renderPanel(response);

    const career = screen.getByRole('region', { name: 'Career' });
    const finance = screen.getByRole('region', { name: 'Finance' });

    expect(within(career).getByText(/still being prepared/i)).toBeInTheDocument();
    expect(within(finance).getByText(/could not be calculated/i)).toBeInTheDocument();

    // Neither message appears for the other domain - a single shared unavailable path would satisfy the two
    // assertions above while still being the #50 collapse.
    expect(within(career).queryByText(/could not be calculated/i)).toBeNull();
    expect(within(finance).queryByText(/still being prepared/i)).toBeNull();
  });

  it('carries the status in data attributes so a test can distinguish the branches structurally', () => {
    const response: InterpretationsResponse = {
      sourceRevision: 'rev-1',
      sections: [{ domain: 'career', status: 'pending', text: null, factors: [] }],
    };
    renderPanel(response);
    expect(screen.getByRole('region', { name: 'Career' })).toHaveAttribute('data-status', 'pending');
  });

  it('keeps other domains usable when one fails', () => {
    const response: InterpretationsResponse = {
      sourceRevision: 'rev-1',
      sections: [
        { domain: 'career', status: 'failed', text: null, factors: [] },
        { domain: 'marriage', status: 'ready', text: 'Marriage reading text.', factors: [] },
      ],
    };
    renderPanel(response);

    expect(screen.getByText(/could not be calculated/i)).toBeInTheDocument();
    expect(screen.getByText('Marriage reading text.')).toBeInTheDocument();
    // The section heading is still there: a failed domain does not error the page.
    expect(screen.getByRole('heading', { name: 'Interpretations' })).toBeInTheDocument();
  });

  /*
   * The no-reason half, which is the half that gets missed. The contract defines \`failed\` with no reason code, so the
   * API cannot say why. The UI must still name the DOMAIN (so the sentence belongs to a section) and must not invent
   * or surface a reason. Ruled: name the domain neutrally, surface a reason only if one exists.
   */
  it('names the domain, and only the domain, when a failure carries no reason', () => {
    const response: InterpretationsResponse = {
      sourceRevision: 'rev-1',
      sections: [
        { domain: 'career', status: 'failed', text: null, factors: [] },
        { domain: 'wellbeing', status: 'failed', text: null, factors: [] },
      ],
    };
    renderPanel(response);

    // Named per domain - the same sentence twice with no domain would leave the reader unable to tell which failed.
    expect(screen.getByText('The Career interpretation could not be calculated.')).toBeInTheDocument();
    expect(screen.getByText('The Wellbeing interpretation could not be calculated.')).toBeInTheDocument();

    // Nothing beyond the neutral sentence: no dangling punctuation where a reason would have gone, no "unknown".
    expect(screen.queryByText(/\(\)|unknown|undefined|null/i)).toBeNull();
  });

  it('does not render raw server prose as the failure reason', () => {
    const response: InterpretationsResponse = {
      sourceRevision: 'rev-1',
      sections: [{ domain: 'career', status: 'failed', text: null, factors: [] }],
    };
    renderPanel(response);
    expect(screen.queryByText(/internal server error|stack trace|exception/i)).toBeNull();
  });

  it('renders an absent domain as not returned, not as a failure', () => {
    const response: InterpretationsResponse = {
      sourceRevision: 'rev-1',
      sections: [{ domain: 'career', status: 'ready', text: 'Career reading text.', factors: [] }],
    };
    renderPanel(response);

    const finance = screen.getByRole('region', { name: 'Finance' });
    expect(within(finance).getByText(/no interpretation was returned/i)).toBeInTheDocument();
    expect(within(finance).queryByText(/could not be calculated/i)).toBeNull();
  });

  it('says the service is not connected, and names what is outstanding', () => {
    renderPanel(null);
    expect(screen.getByRole('heading', { name: /not available yet/i })).toBeInTheDocument();
    expect(screen.getByText(/interpretations request is not built/i)).toBeInTheDocument();
  });

  /*
   * The divergence guard carried from #121. Both payloads drive the SAME component; the assertion is that the output
   * differs. An implementation that hardcoded every domain as "present" or that ignored the payload's statuses
   * produces identical output for both and fails here.
   */
  it('renders two disagreeing payloads to different states', () => {
    const { unmount } = renderPanel(allReady());
    const allReadyTexts = domainRegions().map((region) => region.getAttribute('data-status'));
    unmount();

    const disagreeing: InterpretationsResponse = {
      sourceRevision: 'rev-2',
      sections: [
        { domain: 'career', status: 'pending', text: null, factors: [] },
        { domain: 'marriage', status: 'failed', text: null, factors: [] },
        // wellbeing and the rest deliberately omitted -> absent
      ],
    };
    renderPanel(disagreeing);
    const disagreeingTexts = domainRegions().map((region) => region.getAttribute('data-status'));

    expect(allReadyTexts).toEqual(['ready', 'ready', 'ready', 'ready', 'ready']);
    expect(disagreeingTexts).toEqual(['pending', 'failed', 'absent', 'absent', 'absent']);
    expect(allReadyTexts).not.toEqual(disagreeingTexts);
  });

  it('renders one region per contract domain, in contract order', () => {
    renderPanel(allReady());
    const names = domainRegions().map((region) => region.getAttribute('data-domain'));
    expect(names).toEqual(['career', 'marriage', 'wellbeing', 'finance', 'education']);
  });
});

describe('toDomainViews', () => {
  it('treats a ready section with no text as failed rather than rendering an empty paragraph', () => {
    const views = toDomainViews(
      {
        sourceRevision: 'rev-1',
        sections: [{ domain: 'career', status: 'ready', text: '   ', factors: [] }],
      },
      ['career'],
    );
    expect(views.at(0)?.status).toBe('failed');
  });

  it('keeps pending and failed distinct through the reducer', () => {
    const views = toDomainViews(
      {
        sourceRevision: 'rev-1',
        sections: [
          { domain: 'career', status: 'pending', text: null, factors: [] },
          { domain: 'marriage', status: 'failed', text: null, factors: [] },
        ],
      },
      ['career', 'marriage'],
    );
    expect(views.map((view) => view.status)).toEqual(['pending', 'failed']);
  });
});
