import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';

import { renderWithProviders } from '../../test/render';
import type { BirthTimeError } from './birth-time-write';
import { BirthTimeInput, type BirthTimeModeChoice } from './BirthTimeInput';

/** Controlled host so radio changes actually move the component between modes. */
function Host({
  initialMode = 'exact' as BirthTimeModeChoice,
  error = null as BirthTimeError | null,
}: {
  initialMode?: BirthTimeModeChoice;
  error?: BirthTimeError | null;
}) {
  const [state, setState] = useState({ mode: initialMode, from: '', to: '' });
  return (
    <BirthTimeInput mode={state.mode} from={state.from} to={state.to} error={error} onChange={setState} />
  );
}

describe('KUN-06 birth-time input', () => {
  it('presents the mode as an explicit choice, not a defaulted field', () => {
    renderWithProviders(<Host />);

    const group = screen.getByRole('group', { name: 'Time of birth' });
    expect(group).toBeInTheDocument();
    // Three named options, one of them checked - the user must be able to pick, and see what is picked.
    for (const name of ['Exact', 'Approximate', 'Unknown']) {
      expect(screen.getByRole('radio', { name })).toBeInTheDocument();
    }
    expect(screen.getByRole('radio', { name: 'Exact' })).toBeChecked();
  });

  it('shows one time input for exact and two for approximate', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Host />);

    expect(screen.getAllByLabelText(/Time/)).toHaveLength(1);

    await user.click(screen.getByRole('radio', { name: 'Approximate' }));
    expect(screen.getByLabelText('From')).toBeInTheDocument();
    expect(screen.getByLabelText('To')).toBeInTheDocument();
  });

  it('renders NO time inputs at all when the time is unknown', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Host />);

    await user.click(screen.getByRole('radio', { name: 'Unknown' }));

    // Nothing to leave a stale or sentinel value in.
    expect(screen.queryByLabelText('Time')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('From')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('To')).not.toBeInTheDocument();
    expect(screen.getByText(/No birth time is recorded/)).toBeInTheDocument();
  });

  it('is keyboard operable through native radio semantics', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Host />);

    const exact = screen.getByRole('radio', { name: 'Exact' });
    exact.focus();
    await user.keyboard('{ArrowDown}');

    // Native radios move selection with arrow keys; the component must not intercept that.
    expect(screen.getByRole('radio', { name: 'Approximate' })).toBeChecked();
    expect(screen.getByLabelText('From')).toBeInTheDocument();
  });

  it('marks the invalid field and announces the error', () => {
    renderWithProviders(<Host initialMode="approximate" error={{ code: 'range-not-ascending' }} />);

    const to = screen.getByLabelText('To');
    expect(to).toHaveAttribute('aria-invalid', 'true');
    // The message is announced and is the description of the offending control.
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('The end time must be after the start time.');
    const describedBy = to.getAttribute('aria-describedby');
    expect(describedBy).toBeTruthy();
    expect(document.getElementById(describedBy!)).toHaveTextContent('must be after the start time');
  });

  it('gives the midnight error its own message, distinct from a generic ordering error', () => {
    renderWithProviders(<Host initialMode="approximate" error={{ code: 'window-crosses-midnight' }} />);

    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent(/must not cross midnight/i);
    expect(alert).not.toHaveTextContent('must be after the start time');
  });

  it('says nothing when there is no error', () => {
    renderWithProviders(<Host initialMode="approximate" />);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
