import type { GoodTimesResponse } from '@myvedicstar/contracts';
import { addDays, type LocalDate, todayIn } from '@myvedicstar/date-time';
import {
  buildGoodTimeView,
  defaultActivityKey,
  type ExplainedSegment,
  formatYearMonth,
  yearMonthOf,
} from '@myvedicstar/domain-models';
import { type FormEvent, useId, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';

import { Button } from '../../shared/components/Button';
import { Icon } from '../../shared/components/Icon';
import { EmptyState, ErrorState, Skeleton } from '../../shared/components/states';
import { useNow } from '../../shared/hooks/useNow';
import { useTranslation } from '../../shared/i18n/I18nProvider';
import { useFormatters } from '../../shared/i18n/useFormatters';
import { useLocationState } from '../location';
import { ActivityCards } from './ActivityCards';
import { STATUS_ICON } from './activityIcons';
import { BestGoodTimes } from './BestGoodTimes';
import { GoodTimeMonth } from './GoodTimeMonth';
import styles from './GoodTimePage.module.css';
import {
  useGoodTimeExplanation,
  useGoodTimes,
  useMuhurtaActivities,
  useMuhurtaNakshatras,
} from './useGoodTimes';

const OTHER = 'other';
const OTHER_MAX_LENGTH = 80;

type PlanningView = 'day' | 'month';

/**
 * Find a Good Time. The user picks an activity (and a date); the backend rules engine evaluates the day and is the only
 * source of statuses, Good Times, reasons and conflicts. This page never decides or promotes a time itself: it shows
 * the segments the backend marked `isGoodTime`, explains favorable periods it did not recommend, and says so plainly
 * when no Good Time qualifies.
 *
 * Selection lives in the URL (`?activity=&date=&text=&view=month&month=`), so links can preset an activity; General
 * is the default. The day view evaluates one date; the month view shows each day's status for the activity. The "Next
 * best times" tile lists the backend's best upcoming Good Times for the activity in both views.
 */
export function GoodTimePage() {
  const { t } = useTranslation();
  const { location, openDialog } = useLocationState();
  const [searchParams, setSearchParams] = useSearchParams();
  const questionId = useId();
  const activities = useMuhurtaActivities();
  const stars = useMuhurtaNakshatras();
  const starId = useId();
  const nakshatra = searchParams.get('nakshatra') || undefined;

  const activityList = useMemo(() => activities.data?.activities ?? [], [activities.data]);
  const activity = activities.data
    ? defaultActivityKey(activityList, activities.data.defaultActivity, searchParams.get('activity'))
    : (searchParams.get('activity')?.toLowerCase() ?? 'general');
  const requestedDate = searchParams.get('date') ?? '';
  const date = /^\d{4}-\d{2}-\d{2}$/.test(requestedDate) ? requestedDate : undefined;
  const otherText = activity === OTHER ? (searchParams.get('text') ?? '') : undefined;
  const view: PlanningView = searchParams.get('view') === 'month' ? 'month' : 'day';

  const today = location ? todayIn(location.timeZone) : undefined;
  const shownDate = date ?? today;
  const { query, params } = useGoodTimes(location ? { date, activity, otherText, nakshatra } : null);
  const matchesSelection =
    params !== null &&
    (params.date ?? today) === shownDate &&
    params.activity === activity &&
    params.nakshatra === nakshatra &&
    params.otherText === otherText;
  const response = matchesSelection && !query.isPlaceholderData ? query.data : undefined;
  const explanation = useGoodTimeExplanation(
    params,
    matchesSelection && query.isSuccess && !query.isPlaceholderData,
  );

  const update = (next: Record<string, string | undefined>) => {
    const updated = new URLSearchParams(searchParams);
    for (const [key, value] of Object.entries(next)) {
      if (value === undefined || value === '') updated.delete(key);
      else updated.set(key, value);
    }
    setSearchParams(updated, { replace: true });
  };

  const shownMonth = shownDate ? yearMonthOf(shownDate) : undefined;

  /** Selects a date without changing the user's Day/Month choice. */
  const selectDay = (day: LocalDate) =>
    update({
      date: day === today ? undefined : day,
      ...(view === 'month' ? { month: formatYearMonth(yearMonthOf(day)) } : {}),
    });

  return (
    <section className={styles.page} aria-labelledby="good-time-title">
      <header className={styles.head}>
        <h1 id="good-time-title" className={styles.title}>
          {t('goodTime.title')}
        </h1>
      </header>

      {!location ? (
        <EmptyState
          title={t('summary.chooseLocationTitle')}
          body={t('summary.chooseLocationBody')}
          action={
            <Button onClick={openDialog}>
              <Icon name="search" />
              {t('location.choose')}
            </Button>
          }
        />
      ) : (
        <>
          <div className={styles.planner}>
            <h2 id={questionId} className={styles.question}>
              {t('goodTime.question')}
            </h2>
            {activities.isPending ? (
              <div className={styles.cards} role="status" aria-live="polite">
                <span className="visually-hidden">{t('states.loading')}</span>
                {Array.from({ length: 11 }, (_, i) => (
                  <Skeleton key={i} height="6rem" />
                ))}
              </div>
            ) : activities.isError ? (
              <ErrorState
                error={activities.error}
                onRetry={() => void activities.refetch()}
                retrying={activities.isFetching}
              />
            ) : (
              <ActivityCards
                activities={activityList}
                selected={activity}
                labelledBy={questionId}
                onSelect={(key) =>
                  update({
                    activity: key,
                    text: key === OTHER ? (searchParams.get('text') ?? undefined) : undefined,
                  })
                }
              />
            )}

            {activity === OTHER && (
              // Keyed by the committed text, so the field resets when the URL changes it (back/forward, links).
              <OtherActivityForm
                key={otherText ?? ''}
                initial={otherText ?? ''}
                onSubmit={(text) => update({ text })}
              />
            )}

            <div className={styles.birthStar}>
              <label htmlFor={starId}>{t('goodTime.birthStar')}</label>
              <select
                id={starId}
                value={nakshatra ?? ''}
                onChange={(event) => update({ nakshatra: event.target.value })}
                disabled={stars.isPending}
              >
                <option value="">{t('goodTime.noBirthStar')}</option>
                {stars.data?.map((star) => (
                  <option key={star.key} value={star.name}>
                    {star.name}
                  </option>
                ))}
              </select>
              {stars.isError && (
                <ErrorState
                  error={stars.error}
                  onRetry={() => void stars.refetch()}
                  retrying={stars.isFetching}
                />
              )}
            </div>
            <div className={styles.planningRow}>
              <ViewToggle
                view={view}
                onChange={(next) =>
                  update(
                    next === 'month'
                      ? {
                          view: 'month',
                          date: undefined,
                          month: today ? formatYearMonth(yearMonthOf(today)) : undefined,
                        }
                      : { view: undefined, month: undefined },
                  )
                }
              />

              {shownDate && <DatePicker date={shownDate} today={today} onChange={selectDay} />}
            </div>
          </div>

          <div className={styles.body} data-view={view}>
            <div className={styles.main}>
              {view === 'month' && shownMonth ? (
                <GoodTimeMonth
                  yearMonth={shownMonth}
                  thisMonth={today ? yearMonthOf(today) : undefined}
                  onMonthChange={(next) => selectDay(`${formatYearMonth(next)}-01`)}
                  selectedDate={shownDate}
                  activity={activity}
                  otherText={otherText}
                  nakshatra={nakshatra}
                  onSelectDay={selectDay}
                />
              ) : null}
              <Results
                showAllCards={view === 'month'}
                response={response}
                pending={query.isPending && params !== null}
                updating={query.isFetching && query.isPlaceholderData}
                awaitingDescription={activity === OTHER && !otherText?.trim()}
                error={query.isError ? query.error : undefined}
                onRetry={() => void query.refetch()}
                retrying={query.isFetching}
                explanation={explanation.data}
                onNextDate={shownDate ? () => selectDay(addDays(shownDate, 1)) : undefined}
              />
            </div>
            <BestGoodTimes
              date={shownDate !== today ? shownDate : undefined}
              activity={activity}
              otherText={otherText}
              nakshatra={nakshatra}
              onSelectDay={selectDay}
            />
          </div>
        </>
      )}
    </section>
  );
}

/** Day or month: a pair of radio buttons (native keyboard support), styled as a segmented control. */
function ViewToggle({
  view,
  onChange,
}: Readonly<{ view: PlanningView; onChange: (view: PlanningView) => void }>) {
  const { t } = useTranslation();
  const name = useId();
  return (
    <fieldset className={styles.views}>
      <legend className={styles.viewsLegend}>{t('goodTime.view')}</legend>
      <div className={styles.viewOptions}>
        {(['day', 'month'] as const).map((option) => (
          <label key={option} className={styles.viewOption} data-checked={view === option || undefined}>
            <input
              type="radio"
              name={name}
              value={option}
              checked={view === option}
              onChange={() => onChange(option)}
            />
            <Icon name={option === 'day' ? 'sun' : 'calendar'} size={16} />
            {t(`goodTime.views.${option}`)}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function OtherActivityForm({
  initial,
  onSubmit,
}: Readonly<{ initial: string; onSubmit: (text: string) => void }>) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState(initial);
  const inputId = useId();
  const hintId = useId();

  const submit = (event: FormEvent) => {
    event.preventDefault();
    onSubmit(draft.trim());
  };

  return (
    <form className={styles.other} onSubmit={submit}>
      <label htmlFor={inputId} className={styles.otherLabel}>
        {t('goodTime.otherLabel')}
      </label>
      <div className={styles.otherRow}>
        <input
          id={inputId}
          type="text"
          value={draft}
          maxLength={OTHER_MAX_LENGTH}
          required
          aria-describedby={hintId}
          placeholder={t('goodTime.otherPlaceholder')}
          onChange={(event) => setDraft(event.target.value)}
        />
        <Button type="submit">{t('goodTime.otherSubmit')}</Button>
      </div>
      <p id={hintId} className={styles.hint}>
        {t('goodTime.otherHint')}
      </p>
    </form>
  );
}

function DatePicker({
  date,
  today,
  onChange,
}: Readonly<{ date: string; today: string | undefined; onChange: (date: string) => void }>) {
  const { t } = useTranslation();
  const format = useFormatters();
  return (
    <div className={styles.date} role="group" aria-label={t('goodTime.date')}>
      <Button
        variant="ghost"
        aria-label={t('goodTime.previousDay')}
        onClick={() => onChange(addDays(date, -1))}
      >
        ‹
      </Button>
      <span className={styles.dateText} aria-live="polite">
        {format.date(date)}
      </span>
      <Button variant="ghost" aria-label={t('goodTime.nextDay')} onClick={() => onChange(addDays(date, 1))}>
        ›
      </Button>
      {today && (
        <Button variant="secondary" onClick={() => onChange(today)}>
          {t('goodTime.today')}
        </Button>
      )}
    </div>
  );
}

function Results({
  showAllCards,
  response,
  pending,
  updating,
  awaitingDescription,
  error,
  onRetry,
  retrying,
  explanation,
  onNextDate,
}: Readonly<{
  showAllCards: boolean;
  response: GoodTimesResponse | undefined;
  pending: boolean;
  updating: boolean;
  awaitingDescription: boolean;
  error: unknown;
  onRetry: () => void;
  retrying: boolean;
  explanation: { source: string; summary: string } | undefined;
  onNextDate: (() => void) | undefined;
}>) {
  const { t } = useTranslation();
  const now = useNow();
  const view = useMemo(() => (response ? buildGoodTimeView(response, now) : undefined), [response, now]);

  let body;
  if (awaitingDescription && !response) {
    body = <p className={styles.hint}>{t('goodTime.otherRequired')}</p>;
  } else if (error) {
    // The selection stays as it is; only the results area reports the problem.
    body = (
      <div className={styles.state}>
        <p className={styles.stateTitle}>{t('goodTime.errorTitle')}</p>
        <ErrorState error={error} onRetry={onRetry} retrying={retrying} />
      </div>
    );
  } else if (pending || !response || !view) {
    body = (
      <div role="status" className={styles.results}>
        <span className="visually-hidden">{t('goodTime.loading')}</span>
        <Skeleton height="2.5rem" width="60%" />
        <Skeleton height="9rem" />
        <Skeleton height="6rem" />
      </div>
    );
  } else {
    const tz = response.location.timeZone;
    body = (
      <div className={styles.results}>
        <div className={styles.summaryRow}>
          <span className={styles.dayStatus} data-status-tone={view.dayTone}>
            <Icon name={STATUS_ICON[view.dayTone]} size={18} />
            {t('goodTime.dayStatus')}: <strong>{response.dayStatus.name}</strong>
          </span>
          <span className={styles.activityTag}>
            {response.activity.name}
            {response.activity.completeness === 'partial' && (
              <span className={styles.partial}> · {t('goodTime.partial')}</span>
            )}
          </span>
          {updating && <span className={styles.updating}>{t('goodTime.updating')}</span>}
        </div>

        {response.notices.map((notice) => (
          <p key={notice} className={styles.notice}>
            <Icon name="info" size={16} />
            {notice}
          </p>
        ))}

        {showAllCards && view.goodTimes.length === 0 && (
          <section aria-labelledby="recommended-title" className={styles.section}>
            <h2 id="recommended-title" className={styles.sectionTitle}>
              {t('goodTime.recommended', { count: 0 })}
            </h2>
          </section>
        )}
        {view.goodTimes.length > 0 ? (
          <section aria-labelledby="recommended-title" className={styles.section}>
            <h2 id="recommended-title" className={styles.sectionTitle}>
              {t('goodTime.recommended', { count: view.goodTimes.length })}
            </h2>
            <ol className={styles.list}>
              {view.goodTimes.map((item) => (
                <SegmentCard
                  key={item.segment.id}
                  item={item}
                  timeZone={tz}
                  date={response.date}
                  badge={
                    item.segment.id === view.now?.segment.id
                      ? t('goodTime.goodTimeNow')
                      : item.segment.id === view.next?.segment.id
                        ? t('goodTime.nextGoodTime')
                        : item.segment.id === response.goodTimes[0]
                          ? t('goodTime.best')
                          : undefined
                  }
                />
              ))}
            </ol>
          </section>
        ) : (
          <div className={styles.noGoodTime} data-status-tone={view.dayTone} role="status">
            <Icon name="info" size={22} />
            <div>
              <p className={styles.noGoodTimeTitle}>{view.noGoodTime?.message || t('goodTime.noGoodTime')}</p>
              {onNextDate && (
                <Button variant="secondary" onClick={onNextDate}>
                  {t('goodTime.chooseAnotherDate')}
                </Button>
              )}
            </div>
          </div>
        )}

        {(showAllCards || view.notRecommended.length > 0) && (
          <section aria-labelledby="not-recommended-title" className={styles.section}>
            <h2 id="not-recommended-title" className={styles.sectionTitle}>
              {t('goodTime.whyNot')}
            </h2>
            <p className={styles.hint}>
              {t(view.notRecommended.length > 0 ? 'goodTime.whyNotBody' : 'goodTime.noNotRecommended')}
            </p>
            <ul className={styles.list}>
              {view.notRecommended.map((item) => (
                <SegmentCard key={item.segment.id} item={item} timeZone={tz} date={response.date} />
              ))}
            </ul>
          </section>
        )}

        {(showAllCards || explanation) && (
          <section aria-labelledby="in-brief-title" className={styles.brief}>
            <h2 id="in-brief-title" className={styles.sectionTitle}>
              {t('goodTime.inBrief')}
            </h2>
            <p>{explanation?.summary ?? t('goodTime.briefUnavailable')}</p>
            {explanation?.source === 'ai' && <p className={styles.hint}>{t('goodTime.writtenWithAi')}</p>}
          </section>
        )}

        <Timeline segments={view.segments} timeZone={tz} date={response.date} />

        <p className={styles.disclaimer}>{response.disclaimer}</p>
      </div>
    );
  }

  return (
    <div aria-live="polite" aria-busy={pending || updating || undefined} className={styles.resultsRegion}>
      {body}
    </div>
  );
}

/** A segment with its status (icon + text) and the backend's reasons: ✓ supportive, ⚠ conflicts and cautions. */
function SegmentCard({
  item,
  timeZone,
  date,
  badge,
}: Readonly<{ item: ExplainedSegment; timeZone: string; date: string; badge?: string | undefined }>) {
  const { t } = useTranslation();
  const format = useFormatters();
  const { segment } = item;
  return (
    <li className={styles.segment} data-status-tone={item.tone}>
      <div className={styles.segmentHead}>
        <p className={styles.segmentTime}>{format.range(segment.start, segment.end, timeZone, date)}</p>
        {badge && <span className={styles.badge}>{badge}</span>}
      </div>
      <p className={styles.segmentStatus}>
        <Icon name={STATUS_ICON[item.tone]} size={18} />
        {segment.headline}
      </p>
      <p className={styles.why}>{segment.isGoodTime ? t('goodTime.why') : segment.status.name}</p>
      <ul className={styles.reasons}>
        {item.supports.map((reason) => (
          <li key={`${reason.code}-${reason.subject ?? ''}`} data-kind="positive">
            <span aria-hidden="true">✓</span> {reason.label}
          </li>
        ))}
        {item.clearOf.map((reason) => (
          <li key={reason.code} data-kind="positive">
            <span aria-hidden="true">✓</span> {reason.label}
          </li>
        ))}
        {item.conflicts.map((conflict) => (
          <li key={`${conflict.code}-${conflict.start}`} data-kind="conflict">
            <span aria-hidden="true">⚠</span> {conflict.label}:{' '}
            {format.range(conflict.start, conflict.end, timeZone, date)}
          </li>
        ))}
        {item.cautions.map((reason) => (
          <li key={`${reason.code}-${reason.subject ?? ''}`} data-kind="negative">
            <span aria-hidden="true">⚠</span> {reason.label}
          </li>
        ))}
      </ul>
    </li>
  );
}

/** The whole evaluated window as a bar: each segment colored by its backend status, with a text list for everyone. */
function Timeline({
  segments,
  timeZone,
  date,
}: Readonly<{ segments: readonly ExplainedSegment[]; timeZone: string; date: string }>) {
  const { t } = useTranslation();
  const format = useFormatters();
  const first = segments[0];
  const last = segments.at(-1);
  if (!first || !last) return null;
  const start = Date.parse(first.segment.start);
  const span = Date.parse(last.segment.end) - start;
  return (
    <section aria-labelledby="timeline-title" className={styles.section}>
      <h2 id="timeline-title" className={styles.sectionTitle}>
        {t('goodTime.timeline')}
      </h2>
      <div className={styles.timeline} aria-hidden="true">
        {segments.map((item) => (
          <span
            key={item.segment.id}
            className={styles.timelineSegment}
            data-status-tone={item.tone}
            data-good={item.segment.isGoodTime || undefined}
            style={{
              inlineSize: `${((Date.parse(item.segment.end) - Date.parse(item.segment.start)) / span) * 100}%`,
            }}
          />
        ))}
      </div>
      <ol className={styles.timelineList}>
        {segments.map((item) => (
          <li key={item.segment.id} data-status-tone={item.tone}>
            <Icon name={STATUS_ICON[item.tone]} size={14} />
            {t('goodTime.timelineLabel', {
              time: format.range(item.segment.start, item.segment.end, timeZone, date),
              status: item.segment.status.name,
            })}
          </li>
        ))}
      </ol>
    </section>
  );
}
