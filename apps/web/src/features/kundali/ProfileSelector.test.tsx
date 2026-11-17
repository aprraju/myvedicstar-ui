import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '../../test/render';
import { ProfileSelector } from './ProfileSelector';

const options = [
  { id: 'a', name: 'Asha' },
  { id: 'b', name: 'Ravi' },
];

describe('ProfileSelector', () => {
  it('renders a real label and a hint wired through aria-describedby', () => {
    renderWithProviders(<ProfileSelector options={options} value={null} onChange={() => undefined} />);

    const select = screen.getByLabelText('Astro Profile');
    const describedBy = select.getAttribute('aria-describedby');
    expect(describedBy).toBeTruthy();
    expect(document.getElementById(describedBy!)).toHaveTextContent(
      'Choose which profile this Kundali is for.',
    );
  });

  it('shows a placeholder option only while nothing is selected', () => {
    const { unmount } = renderWithProviders(
      <ProfileSelector options={options} value={null} onChange={() => undefined} />,
    );
    expect(screen.getAllByRole('option')).toHaveLength(3);
    unmount();

    renderWithProviders(<ProfileSelector options={options} value="b" onChange={() => undefined} />);
    // Selected: the placeholder is gone, so the control cannot be left on an empty value.
    expect(screen.getAllByRole('option')).toHaveLength(2);
    expect(screen.getByRole('combobox')).toHaveValue('b');
  });

  it('reports the chosen profile id', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(<ProfileSelector options={options} value="a" onChange={onChange} />);

    await user.selectOptions(screen.getByRole('combobox'), 'b');
    expect(onChange).toHaveBeenCalledWith('b');
  });

  it('is disabled when the caller says so', () => {
    renderWithProviders(<ProfileSelector options={options} value="a" onChange={() => undefined} disabled />);
    expect(screen.getByRole('combobox')).toBeDisabled();
  });
});
