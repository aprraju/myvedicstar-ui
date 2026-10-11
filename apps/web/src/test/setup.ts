import '@testing-library/jest-dom/vitest';

import { cleanup, configure } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, beforeEach, vi } from 'vitest';

import { apiRequests } from './msw/handlers';
import { server } from './msw/server';

// Pages are lazily loaded chunks: the first render in a test file can take longer than the 1 s default when the whole
// suite runs in parallel. Waiting longer only affects slow cases; passing assertions still resolve immediately.
configure({ asyncUtilTimeout: 8000 });

// Any request without a handler fails the test: tests never reach live APIs.
beforeAll(() => server.listen({ onUnhandledFrame: 'error' }));
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-09-29T10:00:00-05:00'));
});
afterEach(() => {
  vi.useRealTimers();
  server.resetHandlers();
  apiRequests.length = 0;
  cleanup();
  window.localStorage.clear();
  window.sessionStorage.clear();
  delete document.documentElement.dataset.theme;
});
afterAll(() => server.close());
