import { type DashaSystem, dashaSystemValues } from '@myvedicstar/contracts';
import type { MessageKey } from '@myvedicstar/localization';
import { useId } from 'react';

import { useTranslation } from '../../../shared/i18n/I18nProvider';
import styles from './Dashas.module.css';
import { DashaTimeline } from './DashaTimeline';
import { reasonKey } from './reasonKey';
import { useDashas } from './useDashas';

/**
 * KUN-09 dasha section: pick a system, read its timeline.
 *
 * The system choice is a labelled set of radio buttons rather than a select, because there are three, they are
 * mutually exclusive and the label matters: a user must be able to see which system the dates belong to at all times,
 * not just after opening a menu. The section renders what the server answered for and never falls back to another
 * system's dates — a `chara` response that withholds its timeline is shown as withheld.
 *
 * The `at` instant is deliberately not chosen here: omitting it asks the server for its own now and the response
 * echoes the instant used, which is the only way the highlighted period and the clock the server reasoned about can
 * be guaranteed to agree.
 */
export function DashasSection({
  profileId,
  system,
  onSystemChange,
}: Readonly<{
  profileId: string;
  system: DashaSystem;
  onSystemChange: (system: DashaSystem) => void;
}>) {
  const { t } = useTranslation();
  const groupId = useId();
  const { status, timeline, errorKind, reload } = useDashas(profileId, { system, at: null });

  /** The path's own reason, when the server withheld it. Path values are the response property names. */
  const pathReason = timeline?.unsupported.find((entry) => entry.path === 'PeriodPath')?.reason;

  /**
   * A system whose timeline is empty because the engine withheld it is not an error: the reason code says whether it is
   * "not built", "computed but unproven", or "cannot be known without a birth time", and the section states which.
   */
  const mahadashaReason = timeline?.unsupported.find((entry) => entry.path === 'Mahadashas')?.reason;
  const withheld = status === 'ready' && timeline !== null && timeline.mahadashas.length === 0;

  return (
    <section className={styles.timeline} aria-labelledby={`${groupId}-title`}>
      <h2 id={`${groupId}-title`} className={styles.subheading}>
        {t('kundali.dashas.title')}
      </h2>
      <p className={styles.help}>{t('kundali.dashas.subtitle')}</p>

      <fieldset className={styles.systemFieldset}>
        <legend className={styles.help}>{t('kundali.dashas.systemLabel')}</legend>
        {dashaSystemValues.map((value) => (
          <label key={value} className={styles.systemOption}>
            <input
              type="radio"
              name={groupId}
              value={value}
              checked={system === value}
              onChange={() => onSystemChange(value)}
            />
            <span>{t(`kundali.dashas.system.${value}` as MessageKey)}</span>
          </label>
        ))}
      </fieldset>

      <div role="status" aria-live="polite" className="visually-hidden">
        {status === 'loading' ? t('kundali.dashas.loading') : ''}
      </div>

      {status === 'error' && (
        <div className={styles.state}>
          <p className={styles.help}>{t('kundali.dashas.errorTitle')}</p>
          <p className={styles.unsupported} data-error-kind={errorKind}>
            {t('kundali.dashas.errorBody')}
          </p>
          <button type="button" className={styles.retry} onClick={reload}>
            {t('kundali.dashas.retry')}
          </button>
        </div>
      )}

      {status === 'loading' && (
        <div role="status" className={styles.loadingRegion}>
          <span className="visually-hidden">{t('kundali.dashas.loading')}</span>
        </div>
      )}

      {withheld && mahadashaReason !== undefined && (
        <div data-testid="dashas-withheld">
          <h3 className={styles.subheading}>{t('kundali.dashas.unavailableTitle')}</h3>
          <p className={styles.unsupported} data-reason={mahadashaReason}>
            {t(reasonKey(mahadashaReason))}
          </p>
        </div>
      )}

      {status === 'ready' && timeline && (!withheld || mahadashaReason === undefined) && (
        <DashaTimeline timeline={timeline} failedPath={pathReason} />
      )}
    </section>
  );
}
