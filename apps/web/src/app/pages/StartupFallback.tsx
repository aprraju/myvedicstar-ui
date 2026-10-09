import { MAIN_CONTENT_ID } from '../../shared/accessibility/RouteAnnouncer';
import { LoadingState } from '../../shared/components/states';

/** Shown while the first page's code chunk loads, so the screen is never blank. */
export function StartupFallback() {
  return (
    <main id={MAIN_CONTENT_ID} className="error-page">
      <LoadingState />
    </main>
  );
}
