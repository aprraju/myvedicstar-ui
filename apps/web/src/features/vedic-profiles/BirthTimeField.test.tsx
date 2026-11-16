import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { I18nProvider } from '../../shared/i18n/I18nProvider';
import { BirthTimeField, changeBirthTimeMode, EMPTY_BIRTH_TIME, isDraftSavable } from './BirthTimeField';

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
