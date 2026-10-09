import { ApiError } from '@myvedicstar/api-client';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { axeViolations } from '../../test/axe';
import { renderWithProviders } from '../../test/render';
import { Button } from './Button';
import { EmptyState, ErrorState, LoadingState } from './states';

describe('ErrorState', () => {
  it('shows a friendly message and a retry action, without the support reference', async () => {
    const onRetry = vi.fn();
    const { container } = renderWithProviders(
      <ErrorState error={new ApiError({ kind: 'network', correlationId: 'abc123' })} onRetry={onRetry} />,
    );
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent("We couldn't reach My Vedic Star");
    expect(alert).not.toHaveTextContent('abc123');
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(onRetry).toHaveBeenCalledOnce();
    expect(await axeViolations(container)).toEqual([]);
  });

  it('never shows raw server or exception text', () => {
    renderWithProviders(<ErrorState error={new Error('SqlException at db-prod-01: timeout')} />);
    expect(screen.getByRole('alert')).toHaveTextContent('Something went wrong');
    expect(screen.getByRole('alert')).not.toHaveTextContent('SqlException');
  });

  it('does not offer retry for errors retrying cannot fix', () => {
    renderWithProviders(
      <ErrorState error={new ApiError({ kind: 'authorization', status: 403 })} onRetry={vi.fn()} />,
    );
    expect(screen.getByRole('alert')).toHaveTextContent("You don't have access to this.");
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});

describe('LoadingState and EmptyState', () => {
  it('announce loading to assistive technology', () => {
    renderWithProviders(<LoadingState />);
    expect(screen.getByRole('status')).toHaveTextContent('Loading…');
  });

  it('render a designed empty state', () => {
    renderWithProviders(<EmptyState title="No saved locations" body="Search for a place to save it." />);
    expect(screen.getByText('No saved locations')).toBeInTheDocument();
  });
});

describe('Button', () => {
  it('blocks repeat activation while loading (no duplicate submissions)', async () => {
    const onClick = vi.fn();
    renderWithProviders(
      <Button loading onClick={onClick}>
        Save
      </Button>,
    );
    const button = screen.getByRole('button', { name: /save/i });
    expect(button).toHaveAttribute('aria-busy', 'true');
    await userEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });
});
