import type { GoodTimesResponse } from '@myvedicstar/contracts';
import { addDays, type LocalDate, todayIn } from '@myvedicstar/date-time';
import {
  buildGoodTimeView,
  defaultActivityKey,
  formatYearMonth,
  yearMonthOf,
} from '@myvedicstar/domain-models';
import { type FormEvent, useId, useMemo, useState, useSyncExternalStore } from 'react';
import { useSearchParams } from 'react-router';

import { Button } from '../../shared/components/Button';
import { Icon } from '../../shared/components/Icon';
import { EmptyState, ErrorState, Skeleton } from '../../shared/components/states';
import { useNow } from '../../shared/hooks/useNow';
import { useTranslation } from '../../shared/i18n/I18nProvider';
import { useFormatters } from '../../shared/i18n/useFormatters';
import { DayBanner, PanchangPanel, PeriodList, RatingFactors } from '../dashboard';
import { useLocationState } from '../location';
import { ActivityCards } from './ActivityCards';
import { STATUS_ICON } from './activityIcons';
import { BestGoodTimes } from './BestGoodTimes';
import { GoodTimeMonth } from './GoodTimeMonth';
import styles from './GoodTimePage.module.css';
import {
  BestRecommended,
  type GoodTimeUpdate,
  MobileGoodTimeResults,
  MobileGoodTimeSearch,
  NotRecommendedCard,
  RANGE_OPTIONS,
  type RangeDays,
} from './MobileGoodTime';
import {
  useDayPanchang,
  useGoodTimeExplanation,
  useGoodTimes,
  useMuhurtaActivities,
  useMuhurtaNakshatras,
} from './useGoodTimes';

const OTHER = 'other';
const OTHER_MAX_LENGTH = 80;

type PlanningView = 'day' | 'month';

/** Phones and small tablets get the two-step mobile flow (same breakpoint as the mobile header and navigation). */
const MOBILE_MAX_WIDTH = 1024;

function subscribeWidth(listener: () => void) {
  window.addEventListener('resize', listener);
  return () => window.removeEventListener('resize', listener);
}

/**
 * Find a Good Time. The user picks an activity (and a date); the backend rules engine evaluates the day and is the only
 * source of statuses, Good Times, reasons and conflicts. This page never decides or promotes a time itself: it shows
 * the segments the backend marked `isGoodTime`, explains favorable periods it did not recommend, and says so plainly
 * when no Good Time qualifies.
 *
 * Selection lives in the URL (`?activity=&date=&text=&view=month&month=`), so links can preset an activity; General
 * is the default. The day view evaluates one date; the month view shows each day's status for the activity. The "Next
 * best times" tile lists the backend's best upcoming Good Times for the activity in both views.
 *
 * Below 1024px the same selection drives a two-step flow (MobileGoodTime.tsx): a search screen, then results
 * (`?step=results&from=&range=&at=`). Those parameters are ignored on wider windows.
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
  const requestedMonth = searchParams.get('month');
  const monthDate =
    view === 'month' &&
    requestedMonth &&
    /^\d{4}-(0[1-9]|1[0-2])$/.test(requestedMonth) &&
    !today?.startsWith(requestedMonth)
      ? `${requestedMonth}-01`
      : undefined;
  const shownDate = date ?? monthDate ?? today;
  const evaluationDate = date ?? monthDate;
  const { query, params } = useGoodTimes(
    location ? { date: evaluationDate, activity, otherText, nakshatra } : null,
  );
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

  const mobile = useSyncExternalStore(
    subscribeWidth,
    () => window.innerWidth < MOBILE_MAX_WIDTH,
    () => false,
  );
  const update: GoodTimeUpdate = (next, options) => {
    const updated = new URLSearchParams(searchParams);
    for (const [key, value] of Object.entries(next)) {
      if (value === undefined || value === '') updated.delete(key);
      else updated.set(key, value);
    }
    // Phones: changing a selection in place (date, view, activity, star, range) keeps the scroll position.
    setSearchParams(updated, options?.push ? {} : { replace: true, preventScrollReset: mobile });
  };

  const requestedRange = Number(searchParams.get('range'));
  const days: RangeDays = RANGE_OPTIONS.find((option) => option === requestedRange) ?? RANGE_OPTIONS[0];
  const requestedFrom = searchParams.get('from') ?? '';
  /** First day of "Next best days": the date the user chose (Day / Month / Today); choosing a best day keeps it. */
  const rangeStart = /^\d{4}-\d{2}-\d{2}$/.test(requestedFrom) ? requestedFrom : shownDate;
  // The date controls (Day / Month, ‹ date ›, the month grid) keep showing the user's own choice; a day picked from
  // "Next best days" changes only the results.
  const shownMonth = rangeStart ? yearMonthOf(rangeStart) : undefined;

  /** Selects a date without changing the user's Day/Month choice; it also becomes the start of "Next best days". */
  const selectDay = (day: LocalDate) =>
    update({
      date: day === today ? undefined : day,
      from: undefined,
      ...(view === 'month' ? { month: formatYearMonth(yearMonthOf(day)) } : {}),
    });

  // Wide windows: the Panchang page's day banner for the day shown (same month query as the Panchang cards below).
  const bannerDay = useDayPanchang(shownDate, !mobile && location !== null);

  if (mobile && location && shownDate) {
    const selection = { activity, otherText, nakshatra };
    if (searchParams.get('step') === 'results') {
      return (
        <MobileGoodTimeResults
          activityList={activityList}
          selection={selection}
          from={rangeStart ?? shownDate}
          days={days}
          today={today}
          at={searchParams.get('at') ?? undefined}
          response={response}
          pending={query.isPending && params !== null}
          error={query.isError ? query.error : undefined}
          onRetry={() => void query.refetch()}
          retrying={query.isFetching}
          explanation={explanation.data}
          update={update}
        />
      );
    }
    return (
      <MobileGoodTimeSearch
        activities={activities}
        activityList={activityList}
        selection={selection}
        stars={stars}
        view={view}
        date={shownDate}
        today={today}
        update={update}
      />
    );
  }

  return (
    <section className={styles.page} aria-labelledby="good-time-title">
      {bannerDay.dashboard && location && (
        <div className={styles.pageBanner}>
          <DayBanner summary={bannerDay.dashboard.summary} location={location} />
        </div>
      )}
      {/* The page name is for screen readers; the planner sits on the banner, as on the Panchang page. */}
      <h1 id="good-time-title" className="visually-hidden">
        {t('goodTime.title')}
      </h1>

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
          <div className={`${styles.planner} ${bannerDay.dashboard ? styles.onBanner : ''}`}>
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

              {rangeStart && <DatePicker date={rangeStart} today={today} onChange={selectDay} />}
            </div>
          </div>

          <div className={styles.body} data-view={view}>
            <div className={styles.main}>
              {view === 'month' && shownMonth ? (
                <GoodTimeMonth
                  yearMonth={shownMonth}
                  thisMonth={today ? yearMonthOf(today) : undefined}
                  onMonthChange={(next) => selectDay(`${formatYearMonth(next)}-01`)}
                  selectedDate={rangeStart}
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
              // Always the searched range from the chosen start (today by default), so 30 / 60 / 90 changes the list.
              date={rangeStart}
              activity={activity}
              otherText={otherText}
              nakshatra={nakshatra}
              days={days}
              onDaysChange={(next) => update({ range: next === RANGE_OPTIONS[0] ? undefined : String(next) })}
              selectedDate={shownDate}
              // A best day becomes the shown day; the range keeps its start.
              onSelectDay={(day) =>
                update({
                  date: day === today ? undefined : day,
                  from: rangeStart,
                })
              }
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
  const format = useFormatters();
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
            {t('goodTime.dayStatus', { day: format.day(response.date) })}:{' '}
            <strong>{response.dayStatus.name}</strong>
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

        {(showAllCards || explanation) && (
          <section aria-labelledby="in-brief-title" className={styles.brief}>
            <h2 id="in-brief-title" className={styles.sectionTitle}>
              {t('goodTime.inBrief')}
            </h2>
            <p>{explanation?.summary ?? t('goodTime.briefUnavailable')}</p>
            {explanation?.source === 'ai' && <p className={styles.hint}>{t('goodTime.writtenWithAi')}</p>}
          </section>
        )}

        {showAllCards && view.goodTimes.length === 0 && (
          <section aria-labelledby="recommended-title" className={styles.section}>
            <h2 id="recommended-title" className={styles.sectionTitle}>
              {t('goodTime.recommended', { count: 0 })}
            </h2>
          </section>
        )}
        {view.goodTimes.length > 0 ? (
          // The same card as on phones: the best time (or the one chosen), the day's times, and why.
          <DesktopBestRecommended
            key={`${response.date}-${response.activity.key}`}
            response={response}
            view={view}
          />
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
          // The same card style as the best recommended time.
          <NotRecommendedCard items={view.notRecommended} date={response.date} timeZone={tz} />
        )}

        <DayPanchangCards date={response.date} timeZone={tz} />

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

/** The phone layout's best-recommended card on wide windows; choosing one of the day's times features it (not in the URL). */
function DesktopBestRecommended({
  response,
  view,
}: Readonly<{ response: GoodTimesResponse; view: ReturnType<typeof buildGoodTimeView> }>) {
  const { t } = useTranslation();
  const [chosen, setChosen] = useState<string | undefined>(undefined);
  const featured =
    view.goodTimes.find((item) => item.segment.start === chosen) ??
    view.goodTimes.find((item) => item.segment.id === response.goodTimes[0]) ??
    view.goodTimes[0];
  return (
    <BestRecommended
      featured={featured}
      times={view.goodTimes}
      onSelectTime={setChosen}
      chosen={chosen !== undefined && featured?.segment.start === chosen}
      response={response}
      badge={
        featured?.segment.id === view.now?.segment.id
          ? t('goodTime.goodTimeNow')
          : featured?.segment.id === view.next?.segment.id
            ? t('goodTime.nextGoodTime')
            : undefined
      }
      noGoodTime={view.noGoodTime?.message || t('goodTime.noGoodTime')}
      // "In brief" has its own section on wide windows.
      explanation={undefined}
      panel
    />
  );
}

/**
 * The selected day's Panchang, times to avoid and why it is rated as it is — the same cards as the Panchang calendar,
 * from the same month query (shared cache).
 */
function DayPanchangCards({ date, timeZone }: Readonly<{ date: LocalDate; timeZone: string }>) {
  const { t } = useTranslation();
  const format = useFormatters();
  const day = useDayPanchang(date, true);
  if (day.query.isError) return null; // optional context; the evaluation above stands on its own
  if (!day.dashboard) {
    return (
      <div role="status" className={styles.results}>
        <span className="visually-hidden">{t('states.loading')}</span>
        <Skeleton height="10rem" />
      </div>
    );
  }
  return (
    <>
      {day.glossary !== undefined && (
        <PanchangPanel dashboard={day.dashboard} glossary={day.glossary} timeZone={timeZone} />
      )}
      <PeriodList
        id="good-time-avoid"
        tone="caution"
        title={t('dashboard.avoidTitle', { day: format.day(date) })}
        subtitle={t('dashboard.avoidSubtitle')}
        items={day.dashboard.avoid}
        glossary={day.glossary}
        timeZone={timeZone}
        date={date}
      />
      <RatingFactors ratingName={day.dashboard.ratingName} factors={day.dashboard.factors} date={date} />
    </>
  );
}
