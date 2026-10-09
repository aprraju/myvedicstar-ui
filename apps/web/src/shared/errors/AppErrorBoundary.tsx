import type { TelemetryClient } from '@myvedicstar/analytics';
import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  telemetry: TelemetryClient;
  fallback: ReactNode;
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

/** Last-resort boundary for errors outside the router (routes have their own errorElement). */
export class AppErrorBoundary extends Component<Props, State> {
  override state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    this.props.telemetry.trackException(error, {
      source: 'AppErrorBoundary',
      componentStack: info.componentStack?.slice(0, 500),
    });
  }

  override render(): ReactNode {
    return this.state.hasError ? this.props.fallback : this.props.children;
  }
}
