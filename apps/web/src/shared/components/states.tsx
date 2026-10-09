import type { ReactNode } from 'react';

import { toUserFacingError } from '../errors/error-message';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { useTranslation } from '../i18n/I18nProvider';
import { Button } from './Button';
import styles from './states.module.css';

/**
 * Standard Loading / Empty / Error states. Every feature renders these rather than a blank area.
 */

export function LoadingState({ children, label }: { children?: ReactNode; label?: string }) {
  const { t } = useTranslation();
  return (
    <div role="status" aria-live="polite" className={styles.loading}>
      <span className="visually-hidden">{label ?? t('states.loading')}</span>
      {children ?? (
        <>
          <Skeleton height="1.5rem" width="40%" />
          <Skeleton height="1rem" />
          <Skeleton height="1rem" width="80%" />
        </>
      )}
    </div>
  );
}

/**
 * React applies `style` through the CSSOM at runtime, which a strict `style-src 'self'` CSP permits
 * (only style attributes in served HTML and <style> elements are blocked).
 */
export function Skeleton({ height = '1rem', width = '100%' }: { height?: string; width?: string }) {
  return (
    <span className={styles.skeleton} style={{ blockSize: height, inlineSize: width }} aria-hidden="true" />
  );
}

export function EmptyState({ title, body, action }: { title: string; body?: string; action?: ReactNode }) {
  return (
    <div className={styles.empty}>
      <p className={styles.title}>{title}</p>
      {body && <p className={styles.body}>{body}</p>}
      {action}
    </div>
  );
}

export function ErrorState({
  error,
  onRetry,
  retrying = false,
}: {
  error: unknown;
  onRetry?: () => void;
  retrying?: boolean;
}) {
  const { t } = useTranslation();
  const online = useOnlineStatus();
  const { messageKey, retryable } = toUserFacingError(error, online);
  return (
    <div role="alert" className={styles.error}>
      <p className={styles.title}>{t(messageKey)}</p>
      {onRetry && retryable && (
        <Button variant="secondary" onClick={onRetry} loading={retrying}>
          {t('states.retry')}
        </Button>
      )}
    </div>
  );
}

export function OfflineBanner() {
  const { t } = useTranslation();
  const online = useOnlineStatus();
  if (online) return null;
  return (
    <div role="status" className={styles.offline}>
      {t('states.offline')}
    </div>
  );
}
