import { useTranslation } from '../../../shared/i18n/I18nProvider';
import type { FieldView } from './certainty';
import styles from './Overview.module.css';

/**
 * Renders any overview field through the same three states, so an unavailable block looks identical wherever it
 * appears and never falls back to a dash, a zero or a guess. The reason is localized from a code; server prose is
 * never rendered.
 */
export function FieldValue({ view, label }: { view: FieldView; label: string }) {
  const { t } = useTranslation();

  if (view.kind === 'unavailable') {
    return (
      <span className={styles.unavailable} data-state="unavailable">
        <span className={styles.unavailableText}>{t('kundali.overview.unavailable')}</span>
        <span className={styles.unavailableReason}>
          {' — '}
          {t(`kundali.overview.reason.${view.reason}`)}
        </span>
        <span className="visually-hidden"> {label}</span>
      </span>
    );
  }

  if (view.kind === 'range') {
    return (
      <span className={styles.range} data-state="range">
        <span className="visually-hidden">{t('kundali.overview.approximateLabel')} </span>
        {t('kundali.overview.range', { from: view.from, to: view.to })}
      </span>
    );
  }

  return <span data-state="value">{view.value}</span>;
}
