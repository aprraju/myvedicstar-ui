import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '../../../test/render';
import type { ResultIdentity } from './revision';
import { RefreshingNotice, StaleResultNotice } from './StaleResultNotice';

const config = {
  ayanamsa: 'Lahiri',
  houseSystem: 'whole-sign',
  engineVersion: '2.10.03',
  ruleSetVersion: 'r1',
};

const identity = (revision: number, overrides: Partial<ResultIdentity['config']> = {}): ResultIdentity => ({
  profileId: 'p1',
  revision,
  config: { ...config, ...overrides },
});

const stale = (requested = identity(5), computedFor = identity(4)) =>
  renderWithProviders(
    <StaleResultNotice
      requested={requested}
      computedFor={computedFor}
      onRefresh={() => undefined}
      refreshing={false}
    />,
  );

describe('KUN-21 stale result affordance', () => {
  it('announces WHICH revision the visible value came from and which is now wanted', () => {
    stale();

    const notice = screen.getByTestId('stale-result-notice');
    // The diagnostic is the content, not decoration: a generic "may be out of date" is not actionable.
    expect(notice).toHaveTextContent(/revision 4, now 5/i);
  });

  it('puts both revision numbers inside the announced status region', () => {
    stale();

    const region = screen.getByRole('status');
    expect(region).toHaveTextContent('4');
    expect(region).toHaveTextContent('5');
  });

  it('names a settings change rather than reporting a revision', () => {
    stale(identity(4, { ayanamsa: 'Raman' }), identity(4));

    const notice = screen.getByTestId('stale-result-notice');
    expect(notice).toHaveTextContent(/calculation settings changed/i);
    // A same-revision config change must not claim a revision moved.
    expect(notice.textContent).not.toMatch(/revision \d+, now \d+/i);
  });

  it('never reads as current data', () => {
    stale();
    expect(screen.getByTestId('stale-result-notice').textContent).not.toMatch(/up to date/i);
  });

  it('offers a real, labelled refresh control that is reachable by keyboard', async () => {
    const onRefresh = vi.fn();
    renderWithProviders(
      <StaleResultNotice
        requested={identity(5)}
        computedFor={identity(4)}
        onRefresh={onRefresh}
        refreshing={false}
      />,
    );

    const button = screen.getByRole('button', { name: 'Update now' });
    await userEvent.tab();
    expect(button).toHaveFocus();

    await userEvent.keyboard('{Enter}');
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it('disables the control and says it is updating while the new revision is in flight', () => {
    renderWithProviders(
      <StaleResultNotice
        requested={identity(5)}
        computedFor={identity(4)}
        onRefresh={() => undefined}
        refreshing
      />,
    );

    const button = screen.getByRole('button', { name: /updating/i });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'true');
  });

  it('explains a wait with its own announcement', () => {
    renderWithProviders(<RefreshingNotice />);
    expect(screen.getByTestId('refreshing-notice')).toHaveAttribute('role', 'status');
  });
});
