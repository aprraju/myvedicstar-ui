import type { LocalDate } from '@myvedicstar/date-time';
import { buildBestGoodTimes } from '@myvedicstar/domain-models';
import { useId, useMemo } from 'react';

import { Button } from '../../shared/components/Button';
import { Icon } from '../../shared/components/Icon';
import { ErrorState, Skeleton } from '../../shared/components/states';
import { useTranslation } from '../../shared/i18n/I18nProvider';
import { useFormatters } from '../../shared/i18n/useFormatters';
import { STATUS_ICON } from './activityIcons';
import styles from './BestGoodTimes.module.css';
import { BEST_COUNT, useBestGoodTimes } from './useGoodTimes';

/** Reasons shown per option; the day view has the full list. */
const REASONS_SHOWN = 2;

/**
 * "Next best times": the backend's best upcoming Good Times for the selected activity, one per day, best first
 * (`/muhurta/good-times/best`). Only Good Times are listed; when none qualifies, the backend's message is shown.
 */
export function BestGoodTimes({
  activity,
  otherText,
  nakshatra,
  onSelectDay,
}: Readonly<{
  activity: string;
  otherText: string | undefined;
  nakshatra?: string | undefined;
  onSelectDay: (date: LocalDate) => void;
}>) {
  const { t } = useTranslation();
  const format = useFormatters();
  const titleId = useId();
  const awaitingDescription = activity === 'other' && !otherText?.trim();
  const query = useBestGoodTimes(awaitingDescription ? null : { activity, otherText, nakshatra });
  const response = query.data;
  const items = useMemo(() => buildBestGoodTimes(response), [response]);

  let body;
  if (awaitingDescription) {
    body = <p className={styles.hint}>{t('goodTime.bestOtherRequired')}</p>;
  } else if (query.isError) {
    body = (
      <div className={styles.state}>
        <p className={styles.stateTitle}>{t('goodTime.bestError')}</p>
        <ErrorState error={query.error} onRetry={() => void query.refetch()} retrying={query.isFetching} />
      </div>
    );
  } else if (!response) {
    body = (
      <div role="status" className={styles.list}>
        <span className="visually-hidden">{t('goodTime.bestLoading')}</span>
        {Array.from({ length: BEST_COUNT }, (_, i) => (
          <Skeleton key={i} height="5.5rem" />
        ))}
      </div>
    );
  } else if (items.length === 0) {
    body = (
      <p className={styles.empty} role="status">
        <Icon name="info" size={18} />
        {response.noGoodTimeMessage || t('goodTime.noGoodTime')}
      </p>
    );
  } else {
    const tz = response.location.timeZone;
    body = (
      <>
        <p className={styles.hint}>
          {t('goodTime.bestSubtitle', {
            activity: response.activity.name,
            from: format.date(response.searchedFrom),
            through: format.date(response.searchedThrough),
          })}
        </p>
        <ol className={styles.list}>
          {items.map((item) => (
            <li
              key={`${item.date}-${item.segment.id}`}
              className={styles.option}
              data-status-tone={item.tone}
            >
              <span className={styles.rank} aria-label={t('goodTime.bestRank', { rank: item.rank })}>
                {item.rank}
              </span>
              <div className={styles.optionBody}>
                <p className={styles.optionDate}>{format.date(item.date)}</p>
                <p className={styles.optionTime}>
                  {format.range(item.segment.start, item.segment.end, tz, item.date)}
                </p>
                <p className={styles.optionStatus}>
                  <Icon name={STATUS_ICON[item.tone]} size={16} />
                  {item.segment.status.name}
                </p>
                {item.supports.length > 0 && (
                  <ul className={styles.reasons}>
                    {item.supports.slice(0, REASONS_SHOWN).map((reason) => (
                      <li key={`${reason.code}-${reason.subject ?? ''}`}>
                        <span aria-hidden="true">✓</span> {reason.label}
                      </li>
                    ))}
                  </ul>
                )}
                <Button
                  variant="secondary"
                  onClick={() => onSelectDay(item.date)}
                  aria-label={t('goodTime.bestViewDayFor', { date: format.date(item.date) })}
                >
                  {t('goodTime.bestViewDay')}
                </Button>
              </div>
            </li>
          ))}
        </ol>
        {query.isFetching && query.isPlaceholderData && (
          <p className={styles.hint}>{t('goodTime.updating')}</p>
        )}
      </>
    );
  }

  return (
    <aside className={styles.tile} aria-labelledby={titleId}>
      <h2 id={titleId} className={styles.title}>
        <Icon name="sparkle" size={20} />
        {t('goodTime.bestTitle')}
      </h2>
      <div aria-live="polite">{body}</div>
    </aside>
  );
}
