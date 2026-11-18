import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { I18nProvider } from '../../shared/i18n/I18nProvider';
import {
  BirthTimeField,
  type BirthTimeValue,
  birthTimeWindowError,
  changeBirthTimeMode,
  EMPTY_BIRTH_TIME,
  isDraftSavable,
} from './BirthTimeField';

const renderField = (value = EMPTY_BIRTH_TIME, onChange = vi.fn()) =>
  render(
    <I18nProvider>
      <BirthTimeField value={value} onChange={onChange} />
    </I18nProvider>,
  );

describe('changeBirthTimeMode', () => {
  it('clears the time when the mode becomes unknown', () => {
    const next = changeBirthTimeMode({ mode: 'known', from: '06:30:00', to: '' }, 'unknown');
    expect(next).toEqual({ mode: 'unknown', from: '', to: '' });
  });

  it('clears stale end time when switching to known', () => {
    const next = changeBirthTimeMode({ mode: 'approximate', from: '06:00:00', to: '08:00:00' }, 'known');
    expect(next).toEqual({ mode: 'known', from: '', to: '' });
  });

  it('keeps the start time when going from known to approximate and drops the end', () => {
    const next = changeBirthTimeMode({ mode: 'known', from: '06:30:00', to: '09:00:00' }, 'approximate');
    expect(next).toEqual({ mode: 'approximate', from: '06:30:00', to: '' });
  });

  it('clears both times when switching away from approximate to unknown', () => {
    const next = changeBirthTimeMode({ mode: 'approximate', from: '06:00:00', to: '08:00:00' }, 'unknown');
    expect(next).toEqual({ mode: 'unknown', from: '', to: '' });
  });

  it('is a no-op when the mode does not change', () => {
    const current = { mode: 'known' as const, from: '06:30:00', to: '' };
    expect(changeBirthTimeMode(current, 'known')).toBe(current);
  });
});

describe('BirthTimeField', () => {
  it('shows a single time input when the time is known', () => {
    renderField({ mode: 'known', from: '', to: '' });
    expect(screen.getByLabelText('Time')).toBeInTheDocument();
    expect(screen.queryByLabelText('From')).not.toBeInTheDocument();
  });

  it('hides every time input when the time is unknown', () => {
    renderField({ mode: 'unknown', from: '', to: '' });
    expect(screen.queryByLabelText('Time')).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/From/i)).not.toBeInTheDocument();
    expect(screen.getByText(/calculated for sunrise/i)).toBeInTheDocument();
  });

  it('reveals From and an optional To for an approximate time', () => {
    renderField({ mode: 'approximate', from: '', to: '' });
    expect(screen.getByLabelText('From')).toBeInTheDocument();
    expect(screen.getByLabelText('To (optional)')).toBeInTheDocument();
  });

  it('switching to Unknown discards the entered time', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderField({ mode: 'known', from: '06:30:00', to: '' }, onChange);

    await user.click(screen.getByRole('radio', { name: 'Unknown' }));

    expect(onChange).toHaveBeenCalledWith({ mode: 'unknown', from: '', to: '' });
  });

  it('exposes the three states as a radiogroup so keyboard users can move between them', () => {
    renderField();
    expect(screen.getByRole('radiogroup')).toBeInTheDocument();
    expect(screen.getAllByRole('radio')).toHaveLength(3);
    expect(screen.getByRole('radio', { name: 'Known' })).toBeChecked();
  });
});

describe('isDraftSavable', () => {
  const base = { name: 'Ada', occupation: 'Engineer', relationship: 'self', customRelationship: '' };

  it('allows saving when name and occupation are filled', () => {
    expect(isDraftSavable(base)).toBe(true);
  });

  it('blocks saving while occupation is blank', () => {
    expect(isDraftSavable({ ...base, occupation: '   ' })).toBe(false);
  });

  it('blocks saving while the name is blank', () => {
    expect(isDraftSavable({ ...base, name: '' })).toBe(false);
  });

  it('requires the custom relationship when Other is selected', () => {
    expect(isDraftSavable({ ...base, relationship: 'other', customRelationship: '' })).toBe(false);
    expect(isDraftSavable({ ...base, relationship: 'other', customRelationship: 'Mentor' })).toBe(true);
  });
});

describe('changeBirthTimeMode — exhaustive transition matrix', () => {
  const modes = ['known', 'approximate', 'unknown'] as const;
  const samples: Record<(typeof modes)[number], BirthTimeValue> = {
    known: { mode: 'known', from: '06:30:00', to: '' },
    approximate: { mode: 'approximate', from: '06:00:00', to: '08:00:00' },
    unknown: { mode: 'unknown', from: '', to: '' },
  };

  // Covers all nine pairs, so a future edit to any branch of the function cannot quietly reintroduce a stale value.
  for (const fromMode of modes) {
    for (const toMode of modes) {
      it(`${fromMode} -> ${toMode} never leaves a value the target mode cannot hold`, () => {
        const next = changeBirthTimeMode(samples[fromMode], toMode);
        expect(next.mode).toBe(toMode);

        if (toMode === 'unknown') {
          expect(next.from).toBe('');
          expect(next.to).toBe('');
        }
        if (toMode === 'known') {
          expect(next.to).toBe('');
        }
        if (toMode === 'approximate' && fromMode !== 'approximate') {
          expect(next.to).toBe('');
        }
        // approximate -> approximate is a no-op and returns the same object, asserted separately below.
      });
    }
  }

  it('preserves the start time when widening to approximate, so the user does not retype it', () => {
    const next = changeBirthTimeMode({ mode: 'known', from: '06:30:00', to: '' }, 'approximate');
    expect(next.from).toBe('06:30:00');
    expect(next.to).toBe('');
  });

  it('returns the same object when the mode is unchanged, so React can skip the update', () => {
    for (const mode of modes) {
      expect(changeBirthTimeMode(samples[mode], mode)).toBe(samples[mode]);
    }
  });
});

describe('BirthTimeField — editing inside a mode', () => {
  it('updates the start time without disturbing the mode', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderField({ mode: 'approximate', from: '', to: '08:00:00' }, onChange);

    const from = screen.getByLabelText('From');
    await user.clear(from);
    await user.type(from, '06:00:00');

    expect(onChange).toHaveBeenCalled();
    for (const call of onChange.mock.calls) {
      expect(call[0].mode).toBe('approximate');
      expect(call[0].to).toBe('08:00:00');
    }
  });

  it('keeps the mode as unknown while no time input is rendered', () => {
    renderField({ mode: 'unknown', from: '', to: '' });
    expect(screen.getByRole('radio', { name: 'Unknown' })).toBeChecked();
    expect(screen.queryAllByRole('textbox')).toHaveLength(0);
  });

  it('does not offer a To input for an exact time', () => {
    renderField({ mode: 'known', from: '', to: '' });
    expect(screen.queryByLabelText('To (optional)')).not.toBeInTheDocument();
  });
});

describe('BirthTimeField — approximate window validation', () => {
  it('reports a midnight-crossing window with its own message, not a generic one', () => {
    renderField({ mode: 'approximate', from: '23:30:00', to: '00:30:00' });

    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent(/must not cross midnight/i);
    expect(alert).not.toHaveTextContent(/must be after the start/i);
    // The offending control is marked and described by the message.
    const to = screen.getByLabelText('To (optional)');
    expect(to).toHaveAttribute('aria-invalid', 'true');
    const describedBy = to.getAttribute('aria-describedby');
    expect(describedBy).toBeTruthy();
    expect(document.getElementById(describedBy!)).toHaveTextContent(/must not cross midnight/i);
  });

  it('reports a mis-ordered window as ascending, distinctly from midnight', () => {
    // Morning-only reversal keeps the plain ordering message.
    renderField({ mode: 'approximate', from: '09:00:00', to: '08:00:00' });

    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent(/must be after the start/i);
    expect(screen.getByLabelText('To (optional)')).toHaveAttribute('aria-invalid', 'true');
  });

  it('rejects a zero-length window, because approximate needs a strict range', () => {
    renderField({ mode: 'approximate', from: '10:00:00', to: '10:00:00' });
    expect(screen.getByRole('alert')).toHaveTextContent(/must be after the start/i);
  });

  it('says nothing for a valid window', () => {
    renderField({ mode: 'approximate', from: '14:10:00', to: '15:40:00' });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByLabelText('To (optional)')).not.toHaveAttribute('aria-invalid');
  });

  it('reports the window error through birthTimeWindowError, which the page uses to block Save', () => {
    // The page derives Save from this exact function, so an invalid window cannot be submitted.
    expect(birthTimeWindowError({ mode: 'approximate', from: '23:30:00', to: '00:30:00' })).toBe(
      'crosses-midnight',
    );
    // A late start wrapping past midnight is a wrap; a morning reversal is a plain ordering problem.
    expect(birthTimeWindowError({ mode: 'approximate', from: '15:40:00', to: '14:10:00' })).toBe(
      'crosses-midnight',
    );
    expect(birthTimeWindowError({ mode: 'approximate', from: '09:00:00', to: '08:00:00' })).toBe(
      'not-ascending',
    );
    expect(birthTimeWindowError({ mode: 'approximate', from: '10:00:00', to: '10:00:00' })).toBe(
      'not-ascending',
    );
    expect(birthTimeWindowError({ mode: 'approximate', from: '14:10:00', to: '15:40:00' })).toBeNull();
    // Modes without a window are never blocked by window rules.
    expect(birthTimeWindowError({ mode: 'known', from: '05:45:00', to: '' })).toBeNull();
    expect(birthTimeWindowError({ mode: 'unknown', from: '', to: '' })).toBeNull();
  });
});
