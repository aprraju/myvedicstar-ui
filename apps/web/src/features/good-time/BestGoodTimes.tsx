import { addDays, type LocalDate } from '@myvedicstar/date-time';
import { buildBestGoodTimes, toneForStatus } from '@myvedicstar/domain-models';
import { useId, useMemo } from 'react';

import { Button } from '../../shared/components/Button';
import { Icon } from '../../shared/components/Icon';
import { ErrorState, Skeleton } from '../../shared/components/states';
import { useNow } from '../../shared/hooks/useNow';
import { useTranslation } from '../../shared/i18n/I18nProvider';
import { useFormatters } from '../../shared/i18n/useFormatters';
import { STATUS_ICON } from './activityIcons';
import styles from './BestGoodTimes.module.css';
import { BEST_COUNT, useBestGoodTimes, useBestGoodTimeWindows } from './useGoodTimes';

/** Reasons shown per option; the day view has the full list. */
const REASONS_SHOWN = 2;

/**
 * "Next best times": the backend's best upcoming Good Times for the selected activity, one per day, best first
 * (`/muhurta/good-times/best`). Only Good Times are listed; when none qualifies, the backend's message is shown.
 */
export function BestGoodTimes({
  activity,
  date,
  otherText,
  nakshatra,
  onSelectDay,
}: Readonly<{
  activity: string;
  date?: LocalDate | undefined;
  otherText: string | undefined;
  nakshatra?: string | undefined;
  onSelectDay: (date: LocalDate) => void;
}>) {
  const { t } = useTranslation();
  const now = useNow();
  const format = useFormatters();
  const titleId = useId();
  const awaitingDescription = activity === 'other' && !otherText?.trim();
  const standard = useBestGoodTimes(awaitingDescription || date ? null : { activity, otherText, nakshatra });
  const selected = useBestGoodTimeWindows(
    !awaitingDescription && date ? { date, activity, otherText, nakshatra } : null,
  );
  const query = date ? selected.query : standard;
  const response = date ? (selected.start === date ? selected.query.data : undefined) : standard.data;
  const items = useMemo(() => {
    if (!date) return buildBestGoodTimes(standard.data).filter((item) => Date.parse(item.segment.end) > now);
    if (selected.start !== date) return [];
    return (selected.query.data?.days ?? [])
      .flatMap((day) => {
        const segment = day.bestGoodTime;
        return day.date >= date && day.date <= addDays(date, 29) && day.goodTimeCount > 0 && segment
          ? [{ date: day.date, segment }]
          : [];
      })
      .sort(
        (a, b) =>
          Number(b.segment.status.status === 'HighlyFavorable') -
            Number(a.segment.status.status === 'HighlyFavorable') || a.date.localeCompare(b.date),
      )
      .slice(0, BEST_COUNT)
      .map((day, index) => ({
        rank: index + 1,
        date: day.date,
        segment: day.segment,
        tone: toneForStatus(day.segment.status.status),
        supports: [],
      }));
  }, [date, now, standard.data, selected.query.data, selected.start]);

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
        {('noGoodTimeMessage' in response && response.noGoodTimeMessage) || t('goodTime.noGoodTime')}
      </p>
    );
  } else {
    const tz = response.location.timeZone;
    body = (
      <>
        <p className={styles.hint}>
          {t('goodTime.bestSubtitle', {
            activity: response.activity.name,
            from: format.date(
              date ?? ('searchedFrom' in response ? response.searchedFrom : response.localToday),
            ),
            through: format.date(
              date
                ? addDays(date, 29)
                : 'searchedThrough' in response
                  ? response.searchedThrough
                  : response.localToday,
            ),
          })}
        </p>
        <ol className={styles.list}>
          {items.map((item) => (
            <li
              key={`${item.date}-${item.segment.start}`}
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
        {standard.isFetching && standard.isPlaceholderData && !date && (
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
