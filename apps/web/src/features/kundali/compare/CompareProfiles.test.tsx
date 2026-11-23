import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { I18nProvider } from '../../../shared/i18n/I18nProvider';
import { comparePickerState, type CompareProfileOption, CompareProfiles } from './ComparisonTable';

const ASHA: CompareProfileOption = { id: '11111111-1111-4111-8111-111111111111', name: 'Asha' };
const RAVI: CompareProfileOption = { id: '22222222-2222-4222-8222-222222222222', name: 'Ravi' };
const FOREIGN = '99999999-9999-4999-8999-999999999999';
const profiles = [ASHA, RAVI];

const renderPicker = (props: {
  firstId?: string | null;
  secondId?: string | null;
  onChange?: (next: { first: string | null; second: string | null }) => void;
  list?: readonly CompareProfileOption[];
}) =>
  render(
    <I18nProvider>
      <CompareProfiles
        profiles={props.list ?? profiles}
        firstId={props.firstId ?? null}
        secondId={props.secondId ?? null}
        onChange={props.onChange ?? (() => undefined)}
      >
        {(pair) => <p data-testid="pair">{pair.a.name + ' vs ' + pair.b.name}</p>}
      </CompareProfiles>
    </I18nProvider>,
  );

describe('comparePickerState — the rules a comparison must satisfy', () => {
  it('reports not-enough-profiles when fewer than two are owned, because one profile cannot be compared', () => {
    expect(comparePickerState([ASHA], null, null)).toEqual({ kind: 'not-enough-profiles' });
    expect(comparePickerState([], null, null)).toEqual({ kind: 'not-enough-profiles' });
  });

  it('asks for a selection when either side is missing', () => {
    expect(comparePickerState(profiles, null, null).kind).toBe('needs-selection');
    expect(comparePickerState(profiles, ASHA.id, null).kind).toBe('needs-selection');
    expect(comparePickerState(profiles, null, RAVI.id).kind).toBe('needs-selection');
  });

  it('rejects the same profile on both sides: a profile compared with itself is not a comparison', () => {
    expect(comparePickerState(profiles, ASHA.id, ASHA.id)).toEqual({ kind: 'same-profile' });
  });

  it('rejects an id the caller does not own, so a foreign or deleted profile is never requested', () => {
    expect(comparePickerState(profiles, ASHA.id, FOREIGN)).toEqual({ kind: 'foreign-profile' });
    expect(comparePickerState(profiles, FOREIGN, null)).toEqual({ kind: 'needs-selection' });
    expect(comparePickerState(profiles, FOREIGN, RAVI.id)).toEqual({ kind: 'foreign-profile' });
  });

  it('resolves the pair only when both ids are distinct and owned', () => {
    expect(comparePickerState(profiles, ASHA.id, RAVI.id)).toEqual({ kind: 'ready', a: ASHA, b: RAVI });
  });
});

describe('CompareProfiles — the surface', () => {
  it('says why there is nothing to compare yet instead of rendering an empty table', () => {
    renderPicker({ list: [ASHA] });
    expect(screen.getByTestId('compare-picker-status')).toHaveTextContent(/needs two Astro Profiles/i);
    expect(screen.queryByTestId('pair')).not.toBeInTheDocument();
    expect(screen.queryByTestId('comparison-table')).not.toBeInTheDocument();
  });

  it('labels both selects with a real <label for> and keeps the disabled option off the other side', () => {
    renderPicker({ firstId: ASHA.id });
    const first = screen.getByLabelText('First Astro Profile');
    const second = screen.getByLabelText('Second Astro Profile');

    // The chosen side's profile is disabled in the other select, so the same-profile state is hard to reach by hand.
    const secondOptions = within(second).getAllByRole('option') as HTMLOptionElement[];
    const ashaInSecond = secondOptions.find((option) => option.textContent === 'Asha');
    expect(ashaInSecond?.disabled).toBe(true);
    // The first select never disables its own selection.
    const firstOptions = within(first).getAllByRole('option') as HTMLOptionElement[];
    expect(firstOptions.find((option) => option.textContent === 'Asha')?.disabled).toBe(false);
  });

  it('reports a selection change without inventing a value for the other side', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderPicker({ onChange });

    await user.selectOptions(screen.getByLabelText('Second Astro Profile'), RAVI.id);
    expect(onChange).toHaveBeenCalledWith({ first: null, second: RAVI.id });
  });

  it('renders the comparison only for a ready pair, and hands it the resolved profiles', () => {
    renderPicker({ firstId: ASHA.id, secondId: RAVI.id });
    expect(screen.getByTestId('pair')).toHaveTextContent('Asha vs Ravi');
  });

  it('does not render the comparison for a foreign id, and says no comparison is shown', () => {
    renderPicker({ firstId: ASHA.id, secondId: FOREIGN });
    expect(screen.queryByTestId('pair')).not.toBeInTheDocument();
    expect(screen.getByTestId('compare-picker-status')).toHaveTextContent(/no comparison is shown/i);
  });
});
