import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { installGlobalErrorHandlers } from '../shared/errors/global-error-handlers';
import { createServices } from '../shared/services/services';
import { App } from './App';
import { ConfigErrorScreen } from './config/ConfigErrorScreen';
import { loadRuntimeConfig } from './config/load-config';

/**
 * Loads runtime configuration, creates app services and renders. If configuration is missing or invalid the app
 * renders a friendly error instead of starting half-configured.
 */
export async function bootstrap(container: HTMLElement): Promise<void> {
  const root = createRoot(container);
  try {
    const config = await loadRuntimeConfig();
    const services = createServices(config);
    installGlobalErrorHandlers(services.telemetry);
    root.render(
      <StrictMode>
        <App services={services} />
      </StrictMode>,
    );
  } catch (error) {
    console.error('My Vedic Star failed to start', error);
    root.render(<ConfigErrorScreen />);
  }
}
