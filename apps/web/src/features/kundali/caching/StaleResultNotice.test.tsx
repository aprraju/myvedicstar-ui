import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '../../../test/render';
import { RefreshingNotice, StaleResultNotice } from './StaleResultNotice';

describe('KUN-21 stale result affordance', () => {
  it('states that the results predate the current profile revision', () => {
    renderWithProviders(<StaleResultNotice onRefresh={() => undefined} refreshing={false} />);

    const notice = screen.getByTestId('stale-result-notice');
    expect(notice).toHaveTextContent(/before your latest change/i);
    // It must not read as a success or as current data.
    expect(notice.textContent).not.toMatch(/up to date|current/i);
  });

  it('announces itself politely rather than interrupting', () => {
    renderWithProviders(<StaleResultNotice onRefresh={() => undefined} refreshing={false} />);
    expect(screen.getByTestId('stale-result-notice')).toHaveAttribute('role', 'status');
  });

  it('offers a real, labelled refresh control that is reachable by keyboard', async () => {
    const onRefresh = vi.fn();
    renderWithProviders(<StaleResultNotice onRefresh={onRefresh} refreshing={false} />);

    const button = screen.getByRole('button', { name: 'Update now' });
    // Tab reaches it first because it is the only focusable element in the notice.
    await userEvent.tab();
    expect(button).toHaveFocus();

    await userEvent.keyboard('{Enter}');
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it('disables the control and says it is updating while the new revision is in flight', () => {
    renderWithProviders(<StaleResultNotice onRefresh={() => undefined} refreshing />);

    const button = screen.getByRole('button', { name: /updating/i });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'true');
  });

  it('explains a wait with its own announcement', () => {
    renderWithProviders(<RefreshingNotice />);
    expect(screen.getByTestId('refreshing-notice')).toHaveAttribute('role', 'status');
  });
});
