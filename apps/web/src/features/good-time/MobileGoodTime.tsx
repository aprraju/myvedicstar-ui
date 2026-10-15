import type { GoodTimesResponse, MuhurtaActivity } from '@myvedicstar/contracts';
import { addDays, type LocalDate } from '@myvedicstar/date-time';
import {
  buildGoodTimeView,
  type ExplainedSegment,
  formatYearMonth,
  toneForStatus,
  yearMonthOf,
} from '@myvedicstar/domain-models';
import { useId, useLayoutEffect, useMemo, useRef, useState } from 'react';

import { Button } from '../../shared/components/Button';
import { DropdownSelect } from '../../shared/components/DropdownSelect';
import { Icon } from '../../shared/components/Icon';
import { SheetSelect } from '../../shared/components/SheetSelect';
import { ErrorState, Skeleton } from '../../shared/components/states';
import { useNow } from '../../shared/hooks/useNow';
import { useShrinkToFit } from '../../shared/hooks/useShrinkToFit';
import { useTranslation } from '../../shared/i18n/I18nProvider';
import { useFormatters } from '../../shared/i18n/useFormatters';
import { MonthCalendarCard } from '../calendar/MonthCalendar';
import { DayTimeline, MobileDayDetails, PeriodList } from '../dashboard';
import { useLocationState } from '../location';
import { ActivityCards } from './ActivityCards';
import { activityIcon, STATUS_ICON } from './activityIcons';
import styles from './MobileGoodTime.module.css';
import {
  useBestGoodTimeWindows,
  useDayPanchang,
  type useMuhurtaActivities,
  type useMuhurtaNakshatras,
} from './useGoodTimes';

/** Ranges the user can search for "Next best days" from the search's start date; 30 matches the desktop tile. */
export const RANGE_OPTIONS = [30, 60, 90] as const;
export type RangeDays = (typeof RANGE_OPTIONS)[number];
/** Options shown before "View all recommended times". */
const BEST_SHOWN = 2;
const OTHER = 'other';
const OTHER_MAX_LENGTH = 80;

/** Writes URL parameters (`undefined` removes one); `push` adds a history entry instead of replacing the current one. */
export type GoodTimeUpdate = (next: Record<string, string | undefined>, options?: { push?: boolean }) => void;

/** Same instant, whatever the formatting (the two endpoints may differ in fractional seconds or offset style). */
const sameInstant = (a: string | undefined, b: string | undefined) =>
  a !== undefined && b !== undefined && Date.parse(a) === Date.parse(b);

interface Selection {
  activity: string;
  otherText: string | undefined;
  nakshatra: string | undefined;
}

const shortDate = (date: LocalDate, locale: string, options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat(locale, { ...options, timeZone: 'UTC' }).format(Date.parse(`${date}T00:00:00Z`));

/**
 * Find a Good Time on phones, step 1: what is planned, the optional birth star and a date (a compact day picker that
 * expands into the month view), then Find. Everything lives in the URL, exactly like the desktop page, so nothing is
 * reset when moving between the two steps.
 */
export function MobileGoodTimeSearch({
  activities,
  activityList,
  selection,
  stars,
  view,
  date,
  today,
  update,
}: Readonly<{
  activities: ReturnType<typeof useMuhurtaActivities>;
  activityList: readonly MuhurtaActivity[];
  selection: Selection;
  stars: ReturnType<typeof useMuhurtaNakshatras>;
  view: 'day' | 'month';
  date: LocalDate;
  today: LocalDate | undefined;
  update: GoodTimeUpdate;
}>) {
  const { t } = useTranslation();
  const format = useFormatters();
  const questionId = useId();
  const starId = useId();
  const starHintId = useId();
  const [starInfo, setStarInfo] = useState(false);
  const { activity, otherText, nakshatra } = selection;
  // Other: the description is typed here and committed with Find (no request per keystroke).
  const [otherDraft, setOtherDraft] = useState(otherText ?? '');
  const awaitingDescription = activity === OTHER && !otherDraft.trim();
  const find = () => {
    if (awaitingDescription) return;
    // The searched range always starts on the date chosen here; a next best time or another range never moves it.
    update(
      {
        step: 'results',
        from: date,
        at: undefined,
        ...(activity === OTHER ? { text: otherDraft.trim() } : {}),
      },
      { push: true },
    );
    window.scrollTo({ top: 0 });
  };

  const selectDate = (day: LocalDate) =>
    update({ date: day === today ? undefined : day, month: formatYearMonth(yearMonthOf(day)) });
  const showMonth = (month: boolean) =>
    update(month ? { view: 'month', month: formatYearMonth(yearMonthOf(date)) } : { view: undefined });

  return (
    <section className={styles.page} aria-labelledby="good-time-title">
      <header className={styles.head}>
        <h1 id="good-time-title">{t('goodTime.title')}</h1>
        <p>{t('goodTime.mobile.subtitle')}</p>
      </header>

      <div className={styles.card}>
        <div className={styles.cardHead}>
          <h2 id={questionId}>{t('goodTime.question')}</h2>
          <span className={styles.muted}>{t('goodTime.mobile.selectOne')}</span>
        </div>
        {activities.isPending ? (
          <div className={styles.activities} role="status">
            <span className="visually-hidden">{t('states.loading')}</span>
            <Skeleton height="10rem" />
          </div>
        ) : activities.isError ? (
          <ErrorState
            error={activities.error}
            onRetry={() => void activities.refetch()}
            retrying={activities.isFetching}
          />
        ) : (
          <div className={styles.activities}>
            <ActivityCards
              activities={activityList}
              selected={activity}
              labelledBy={questionId}
              onSelect={(key) => update({ activity: key, text: key === OTHER ? otherText : undefined })}
            />
          </div>
        )}

        {activity === OTHER && (
          // Keyed by the committed text, so the field resets when the URL changes it (back/forward, links).
          <OtherActivity value={otherDraft} onChange={setOtherDraft} onSubmit={find} />
        )}

        <div className={styles.birthStar}>
          <div className={styles.birthStarLabel}>
            <span id={starId}>
              {t('goodTime.mobile.birthStar')}{' '}
              <span className={styles.muted}>{t('goodTime.mobile.optional')}</span>
            </span>
            <button
              type="button"
              className={styles.iconButton}
              aria-label={t('goodTime.mobile.birthStarInfo')}
              aria-expanded={starInfo}
              aria-controls={starHintId}
              onClick={() => setStarInfo(!starInfo)}
            >
              <Icon name="info" size={18} />
            </button>
          </div>
          <p id={starHintId} className={styles.hint} hidden={!starInfo}>
            {t('goodTime.birthStar')}
          </p>
          <DropdownSelect
            labelledBy={starId}
            value={nakshatra ?? ''}
            options={[
              { value: '', label: t('goodTime.mobile.noBirthStar') },
              ...(stars.data ?? []).map((star) => ({ value: star.name, label: star.name })),
            ]}
            onChange={(next) => update({ nakshatra: next })}
            disabled={stars.isPending}
          />
          {stars.isError && (
            <ErrorState
              error={stars.error}
              onRetry={() => void stars.refetch()}
              retrying={stars.isFetching}
            />
          )}
        </div>
      </div>

      <div className={styles.card}>
        <h2 className={styles.cardTitle}>{t('goodTime.mobile.chooseDate')}</h2>
        {/* Same controls as the Panchang calendar on phones: ‹ date ›, then Panchang opens the month. */}
        {view === 'month' ? (
          // The same month calendar as the Panchang page; choosing a day returns to the compact day picker.
          <MonthCalendarCard
            headingId="good-time-month-title"
            yearMonth={yearMonthOf(date)}
            today={today ?? date}
            selected={date}
            onMonthChange={(next) => selectDate(`${formatYearMonth(next)}-01`)}
            onSelect={(day) =>
              update({
                date: day === today ? undefined : day,
                month: formatYearMonth(yearMonthOf(day)),
                view: undefined,
              })
            }
          />
        ) : (
          <div className={styles.dayPicker} role="group" aria-label={t('goodTime.date')}>
            <Button
              variant="secondary"
              aria-label={t('goodTime.previousDay')}
              onClick={() => selectDate(addDays(date, -1))}
            >
              ‹
            </Button>
            <div aria-live="polite">
              <p className={styles.dayPickerDate}>{format.date(date)}</p>
              <p className={styles.dayPickerHint}>{t('goodTime.mobile.selectedDate')}</p>
            </div>
            <Button
              variant="secondary"
              aria-label={t('goodTime.nextDay')}
              onClick={() => selectDate(addDays(date, 1))}
            >
              ›
            </Button>
          </div>
        )}
        <Button
          variant="secondary"
          className={styles.panchangButton}
          aria-pressed={view === 'month'}
          onClick={() => showMonth(view !== 'month')}
        >
          <Icon name="calendar" />
          {t('calendar.backToCalendar')}
        </Button>
      </div>

      {awaitingDescription && <p className={styles.hint}>{t('goodTime.otherRequired')}</p>}
      <Button className={styles.find} disabled={awaitingDescription} onClick={find}>
        <Icon name="search" />
        {t('goodTime.mobile.find')}
      </Button>
    </section>
  );
}

/** "Describe your activity": the text is committed by Find good times (or Enter), not by a separate button. */
function OtherActivity({
  value,
  onChange,
  onSubmit,
}: Readonly<{ value: string; onChange: (text: string) => void; onSubmit: () => void }>) {
  const { t } = useTranslation();
  const inputId = useId();
  const hintId = useId();
  return (
    <div className={styles.other}>
      <label htmlFor={inputId}>{t('goodTime.otherLabel')}</label>
      <input
        id={inputId}
        type="text"
        value={value}
        maxLength={OTHER_MAX_LENGTH}
        required
        enterKeyHint="search"
        aria-describedby={hintId}
        placeholder={t('goodTime.otherPlaceholder')}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && value.trim()) {
            event.preventDefault();
            onSubmit();
          }
        }}
      />
      <p id={hintId} className={styles.hint}>
        {t('goodTime.otherHint')}
      </p>
    </div>
  );
}

/**
 * Find a Good Time on phones, step 2: the search as a small card with Edit, then the day's status, the best (or the
 * chosen) recommended time with its reasons, the next best days over the searched range and the day at a glance.
 * Statuses, Good Times and reasons all come from the backend, as on the desktop page.
 */
export function MobileGoodTimeResults({
  activityList,
  selection,
  from,
  days,
  today,
  at,
  response,
  pending,
  error,
  onRetry,
  retrying,
  explanation,
  update,
}: Readonly<{
  activityList: readonly MuhurtaActivity[];
  selection: Selection;
  /** First day of the searched range. */
  from: LocalDate;
  /** Length of the searched range in days. */
  days: RangeDays;
  today: LocalDate | undefined;
  /** Start of the Good Time chosen from "Next best days"; the day's best one otherwise. */
  at: string | undefined;
  response: GoodTimesResponse | undefined;
  pending: boolean;
  error: unknown;
  onRetry: () => void;
  retrying: boolean;
  explanation: { source: string; summary: string } | undefined;
  update: GoodTimeUpdate;
}>) {
  const { t, locale } = useTranslation();
  const now = useNow();
  const view = useMemo(() => (response ? buildGoodTimeView(response, now) : undefined), [response, now]);

  // Back / Edit: the search screen with every current selection (activity, star, range), starting from the searched
  // date again (a next best time may have moved the detail date).
  const backToSearch = () => {
    update({ step: undefined, from: undefined, at: undefined, date: from === today ? undefined : from });
    window.scrollTo({ top: 0 });
  };

  const featured =
    view && response
      ? ((at ? view.goodTimes.find((item) => sameInstant(item.segment.start, at)) : undefined) ??
        view.goodTimes.find((item) => item.segment.id === response.goodTimes[0]) ??
        view.goodTimes[0])
      : undefined;

  return (
    <section className={styles.page} aria-labelledby="good-time-title">
      <h1 id="good-time-title" className="visually-hidden">
        {t('goodTime.title')}
      </h1>
      <Button variant="ghost" className={styles.back} onClick={backToSearch}>
        <span aria-hidden="true">‹</span> {t('goodTime.mobile.back')}
      </Button>

      <SearchSummary
        activityList={activityList}
        selection={selection}
        from={from}
        days={days}
        onEdit={backToSearch}
      />

      <div aria-live="polite" aria-busy={pending || undefined} className={styles.results}>
        {error ? (
          <div className={styles.card}>
            <p className={styles.strong}>{t('goodTime.errorTitle')}</p>
            <ErrorState error={error} onRetry={onRetry} retrying={retrying} />
          </div>
        ) : !response || !view ? (
          <div role="status" className={styles.results}>
            <span className="visually-hidden">{t('goodTime.loading')}</span>
            <Skeleton height="4.5rem" />
            <Skeleton height="9rem" />
          </div>
        ) : (
          <>
            <section
              className={styles.dayStatus}
              data-status-tone={view.dayTone}
              aria-labelledby="day-status-title"
            >
              <h2 id="day-status-title">
                <Icon name={STATUS_ICON[view.dayTone]} size={20} />
                {t('goodTime.mobile.dayTitle', { status: response.dayStatus.name })}
              </h2>
              <p>
                {t('goodTime.mobile.daySubtitle', {
                  activity: response.activity.name,
                  date: shortDate(response.date, locale, {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                  }),
                })}
                {response.activity.completeness === 'partial' && ` · ${t('goodTime.partial')}`}
              </p>
              {response.notices.map((notice) => (
                <p key={notice} className={styles.notice}>
                  <Icon name="info" size={16} />
                  {notice}
                </p>
              ))}
            </section>

            <BestRecommended
              // A new day or time starts fresh (reasons, disclosure state) rather than reusing the previous one.
              key={`${response.date}-${featured?.segment.start ?? 'none'}`}
              featured={featured}
              times={view.goodTimes}
              onSelectTime={(start) => update({ at: start })}
              chosen={sameInstant(featured?.segment.start, at)}
              response={response}
              badge={
                featured?.segment.id === view.now?.segment.id
                  ? t('goodTime.goodTimeNow')
                  : featured?.segment.id === view.next?.segment.id
                    ? t('goodTime.nextGoodTime')
                    : undefined
              }
              noGoodTime={view.noGoodTime?.message || t('goodTime.noGoodTime')}
              explanation={explanation}
            />
            {view.notRecommended.length > 0 && (
              <NotRecommendedCard
                items={view.notRecommended}
                date={response.date}
                timeZone={response.location.timeZone}
              />
            )}
          </>
        )}

        <NextBestTimes
          selection={selection}
          from={from}
          days={days}
          onDaysChange={(next) => update({ range: next === RANGE_OPTIONS[0] ? undefined : String(next) })}
          // The tapped option stays highlighted while its day loads.
          selectedStart={at ?? featured?.segment.start}
          selectedDate={response?.date}
          onSelect={(day, start) => {
            update({ date: day === today ? undefined : day, at: start });
            window.scrollTo({ top: 0 });
          }}
        />

        {response && view && <DayAtGlance key={response.date} response={response} segments={view.segments} />}
      </div>
    </section>
  );
}

/** The search as a small card: activity, birth star and date range, with Edit (back to the search screen). */
function SearchSummary({
  activityList,
  selection,
  from,
  days,
  onEdit,
}: Readonly<{
  activityList: readonly MuhurtaActivity[];
  selection: Selection;
  from: LocalDate;
  days: RangeDays;
  onEdit: () => void;
}>) {
  const { t, locale } = useTranslation();
  const activity = activityList.find((item) => item.key === selection.activity);
  const activityName =
    selection.activity === OTHER && selection.otherText
      ? `${activity?.name ?? selection.activity}: ${selection.otherText}`
      : (activity?.name ?? selection.activity);
  const through = addDays(from, days - 1);
  const range = new Intl.DateTimeFormat(locale, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).formatRange(Date.parse(`${from}T00:00:00Z`), Date.parse(`${through}T00:00:00Z`));

  return (
    <section className={`${styles.card} ${styles.summary}`} aria-label={t('goodTime.mobile.searchSummary')}>
      <dl className={styles.summaryList}>
        <div>
          <Icon name={activityIcon(activity?.icon ?? 'sun')} size={22} />
          <dt>{t('goodTime.mobile.activity')}</dt>
          <ShrinkingDd text={activityName} />
        </div>
        <div>
          <Icon name="star" size={22} />
          <dt>{t('goodTime.mobile.birthStar')}</dt>
          <dd className={styles.oneLine}>
            {selection.nakshatra ? (
              <FitText full={selection.nakshatra} short={shortStarName(selection.nakshatra)} />
            ) : (
              t('goodTime.mobile.none')
            )}
          </dd>
        </div>
        <div className={styles.summaryRange}>
          <Icon name="calendar" size={22} />
          <dt>{t('goodTime.mobile.dateRange')}</dt>
          <dd>
            <span className={styles.oneLine}>{range}</span>
            <span className={styles.rangeDays}>{t('goodTime.mobile.nextDays', { count: days })}</span>
          </dd>
        </div>
      </dl>
      <Button
        variant="secondary"
        className={styles.edit}
        onClick={onEdit}
        aria-label={t('goodTime.mobile.editSearch')}
      >
        <Icon name="edit" size={18} />
        {t('goodTime.mobile.edit')}
      </Button>
    </section>
  );
}

/** Conventional short form of a nakshatra name for tight spaces: Purva / Poorva → P., Uttara / Uthara → U. */
function shortStarName(name: string) {
  return name.replace(/^(?:Purva|Poorva)\s+/i, 'P. ').replace(/^(?:Uttara|Uthara)\s+/i, 'U. ');
}

/** One line: shrunk a little to fit, then cut with an ellipsis (the full text is in its title). */
function ShrinkingDd({ text }: Readonly<{ text: string }>) {
  const ref = useRef<HTMLElement>(null);
  useShrinkToFit(ref, text);
  return (
    <dd ref={ref} className={styles.oneLine} title={text}>
      {text}
    </dd>
  );
}

/**
 * The full text when it fits on one line, the short form when it does not (measured, and re-measured when the space
 * changes), shrunk a little if even that overflows. Screen readers always get the full text.
 */
function FitText({ full, short }: Readonly<{ full: string; short: string }>) {
  const measureRef = useRef<HTMLSpanElement>(null);
  const [useShort, setUseShort] = useState(false);
  useLayoutEffect(() => {
    const measurer = measureRef.current;
    const container = measurer?.parentElement?.parentElement;
    if (!measurer || !container || short === full) return;
    const measure = () => setUseShort(measurer.offsetWidth > container.clientWidth);
    measure();
    const observer = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(measure);
    observer?.observe(container);
    return () => observer?.disconnect();
  }, [full, short]);
  const shown = useShort ? short : full;
  const textRef = useRef<HTMLSpanElement>(null);
  useShrinkToFit(textRef, shown);
  return (
    <span className={styles.fit}>
      {/* An invisible copy of the full text, measured against the available width. */}
      <span ref={measureRef} className={styles.measure} aria-hidden="true">
        {full}
      </span>
      <span
        ref={textRef}
        className={styles.oneLine}
        aria-hidden={useShort || undefined}
        title={useShort ? full : undefined}
      >
        {shown}
      </span>
      {useShort && <span className="visually-hidden">{full}</span>}
    </span>
  );
}

/** The day's best Good Time (or the one chosen from "Next best days"), with its reasons behind a disclosure. */
export function BestRecommended({
  featured,
  times,
  onSelectTime,
  chosen,
  response,
  badge,
  noGoodTime,
  explanation,
  panel = false,
}: Readonly<{
  featured: ExplainedSegment | undefined;
  /** All of the day's recommended times (as on the desktop page); the featured one is highlighted, tapping another features it. */
  times: readonly ExplainedSegment[];
  onSelectTime: (start: string) => void;
  chosen: boolean;
  response: GoodTimesResponse;
  badge: string | undefined;
  noGoodTime: string;
  explanation: { source: string; summary: string } | undefined;
  /** Wide windows: the dashboard card look (tinted header like "Why {day} is …") and the plural title. */
  panel?: boolean;
}>) {
  const { t } = useTranslation();
  const format = useFormatters();
  const [open, setOpen] = useState(false);
  const whyId = useId();
  const title = panel ? t('goodTime.bestRecommendedTimes') : t('goodTime.mobile.bestRecommended');
  const tz = response.location.timeZone;

  if (!featured) {
    const empty = (
      <p className={styles.empty} role="status">
        <Icon name="info" size={18} />
        {noGoodTime}
      </p>
    );
    return panel ? (
      <section className={styles.panelCard} aria-labelledby="best-recommended-title">
        <PanelHeader
          id="best-recommended-title"
          tone="info"
          icon="info"
          title={title}
          subtitle={t('goodTime.bestRecommendedSubtitle')}
        />
        <div className={styles.panelBody}>{empty}</div>
      </section>
    ) : (
      <section className={styles.card} aria-labelledby="best-recommended-title">
        <h2 id="best-recommended-title" className={styles.eyebrow}>
          {title}
        </h2>
        {empty}
      </section>
    );
  }

  const { segment } = featured;
  const heading = chosen ? t('goodTime.mobile.selectedTime') : title;
  const content = (
    <>
      {panel ? (
        <div className={styles.cardHead}>
          <p className={styles.bestTime}>{format.range(segment.start, segment.end, tz, response.date)}</p>
          <span className={styles.badge}>{segment.status.name}</span>
        </div>
      ) : (
        <p className={styles.bestTime}>{format.range(segment.start, segment.end, tz, response.date)}</p>
      )}
      <p className={styles.bestMeta}>
        <Icon name="clock" size={18} />
        {badge ?? format.date(response.date)}
      </p>
      {times.length > 1 && (
        <div className={styles.others}>
          <p className={styles.othersTitle}>{t('goodTime.recommended', { count: times.length })}</p>
          <ul>
            {times.map((item) => (
              <li key={item.segment.id} data-status-tone={item.tone}>
                <button
                  type="button"
                  aria-current={item === featured || undefined}
                  onClick={() => onSelectTime(item.segment.start)}
                >
                  <span className={styles.othersTime}>
                    {format.range(item.segment.start, item.segment.end, tz, response.date)}
                  </span>
                  <span className={styles.toneText}>{item.segment.status.name}</span>
                  <Icon name="chevronRight" size={18} />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      <button
        type="button"
        className={styles.why}
        aria-expanded={open}
        aria-controls={whyId}
        onClick={() => setOpen(!open)}
      >
        {t('goodTime.mobile.whyRecommended')}
        <Icon name="chevronDown" size={18} />
      </button>
      <div id={whyId} hidden={!open} className={styles.whyBody}>
        <p className={styles.strong}>{segment.headline}</p>
        <Reasons item={featured} timeZone={tz} date={response.date} />
        {explanation && (
          <>
            <p className={styles.strong}>{t('goodTime.inBrief')}</p>
            <p>{explanation.summary}</p>
            {explanation.source === 'ai' && <p className={styles.hint}>{t('goodTime.writtenWithAi')}</p>}
          </>
        )}
      </div>
    </>
  );
  return panel ? (
    <section
      className={styles.panelCard}
      data-status-tone={featured.tone}
      aria-labelledby="best-recommended-title"
    >
      <PanelHeader
        id="best-recommended-title"
        tone="info"
        icon="info"
        title={heading}
        subtitle={t('goodTime.bestRecommendedSubtitle')}
      />
      <div className={styles.panelBody}>{content}</div>
    </section>
  ) : (
    <section
      className={`${styles.card} ${styles.best}`}
      data-status-tone={featured.tone}
      aria-labelledby="best-recommended-title"
    >
      <div className={styles.cardHead}>
        <h2 id="best-recommended-title" className={styles.eyebrow}>
          {heading}
        </h2>
        <span className={styles.badge}>{segment.status.name}</span>
      </div>
      {content}
    </section>
  );
}

/**
 * "Not recommended" in the best-recommended card's style: favorable periods the backend did not recommend because they
 * overlap a period to avoid. Each row shows its time and status; opening it shows the backend's reasons.
 */
export function NotRecommendedCard({
  items,
  date,
  timeZone,
}: Readonly<{ items: readonly ExplainedSegment[]; date: string; timeZone: string }>) {
  const { t } = useTranslation();
  return (
    <section className={styles.panelCard} aria-labelledby="not-recommended-title">
      <PanelHeader
        id="not-recommended-title"
        tone="caution"
        icon="alert"
        title={t('goodTime.whyNot')}
        subtitle={t(items.length > 0 ? 'goodTime.whyNotBody' : 'goodTime.noNotRecommended')}
      />
      {items.length > 0 && (
        <div className={styles.panelBody}>
          <ul className={styles.notList}>
            {items.map((item) => (
              <NotRecommendedRow key={item.segment.id} item={item} date={date} timeZone={timeZone} />
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

/** The dashboard card header: a tinted bar with an icon, a title in the tone's color and a subtitle. */
function PanelHeader({
  id,
  tone,
  icon,
  title,
  subtitle,
}: Readonly<{
  id: string;
  tone: 'info' | 'caution';
  icon: 'info' | 'alert';
  title: string;
  subtitle: string;
}>) {
  return (
    <div className={styles.panelHead} data-tone={tone}>
      <span className={styles.panelIcon} aria-hidden="true">
        <Icon name={icon} size={18} />
      </span>
      <div>
        <h2 id={id} className={styles.panelTitle}>
          {title}
        </h2>
        <p className={styles.panelSubtitle}>{subtitle}</p>
      </div>
    </div>
  );
}

function NotRecommendedRow({
  item,
  date,
  timeZone,
}: Readonly<{ item: ExplainedSegment; date: string; timeZone: string }>) {
  const format = useFormatters();
  const [open, setOpen] = useState(false);
  const reasonsId = useId();
  return (
    <li data-status-tone={item.tone}>
      <button
        type="button"
        className={styles.notRow}
        aria-expanded={open}
        aria-controls={reasonsId}
        onClick={() => setOpen(!open)}
      >
        <span className={styles.othersTime}>
          {format.range(item.segment.start, item.segment.end, timeZone, date)}
        </span>
        <span className={styles.badge}>{item.segment.status.name}</span>
        <Icon name="chevronDown" size={18} />
      </button>
      <div id={reasonsId} hidden={!open} className={styles.whyBody}>
        <p className={styles.strong}>
          <Icon name={STATUS_ICON[item.tone]} size={16} /> {item.segment.headline}
        </p>
        <Reasons item={item} timeZone={timeZone} date={date} />
      </div>
    </li>
  );
}

/** The backend's reasons for a segment: ✓ supportive, ⚠ conflicts and cautions (never color alone). */
function Reasons({
  item,
  timeZone,
  date,
}: Readonly<{ item: ExplainedSegment; timeZone: string; date: string }>) {
  const format = useFormatters();
  return (
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
  );
}

/**
 * The best Good Time of each day in the searched range (`/muhurta/day-summaries`, the same data as the desktop tile),
 * best first. Choosing one shows that day and time above; "View all" lists every day with a Good Time.
 */
function NextBestTimes({
  selection,
  from,
  days,
  onDaysChange,
  selectedStart,
  selectedDate,
  onSelect,
}: Readonly<{
  selection: Selection;
  from: LocalDate;
  days: RangeDays;
  onDaysChange: (days: RangeDays) => void;
  selectedStart: string | undefined;
  /** The day shown above: highlighted when its exact time is not in the list. */
  selectedDate: LocalDate | undefined;
  onSelect: (date: LocalDate, start: string) => void;
}>) {
  const { t } = useTranslation();
  const format = useFormatters();
  const now = useNow();
  const [all, setAll] = useState(false);
  const titleId = useId();
  const { query, start } = useBestGoodTimeWindows({ date: from, days, ...selection });
  const response = start === from ? query.data : undefined;
  const items = useMemo(
    () =>
      (response?.days ?? [])
        .flatMap((day) => {
          const segment = day.bestGoodTime;
          return day.date >= from &&
            day.date <= addDays(from, days - 1) &&
            day.goodTimeCount > 0 &&
            segment &&
            Date.parse(segment.end) > now
            ? [{ date: day.date, segment, tone: toneForStatus(segment.status.status) }]
            : [];
        })
        .sort(
          (a, b) =>
            Number(b.segment.status.status === 'HighlyFavorable') -
              Number(a.segment.status.status === 'HighlyFavorable') || a.date.localeCompare(b.date),
        ),
    [response, from, days, now],
  );
  const shown = all ? items : items.slice(0, BEST_SHOWN);
  // The option shown above (by default the selected day's best time) is highlighted, chosen or not.
  const current =
    items.find((item) => sameInstant(item.segment.start, selectedStart)) ??
    items.find((item) => item.date === selectedDate);

  let body;
  if (query.isError) {
    body = (
      <>
        <p className={styles.strong}>{t('goodTime.bestError')}</p>
        <ErrorState error={query.error} onRetry={() => void query.refetch()} retrying={query.isFetching} />
      </>
    );
  } else if (!response) {
    body = (
      <div role="status" className={styles.results}>
        <span className="visually-hidden">{t('goodTime.bestLoading')}</span>
        <Skeleton height="4.5rem" />
        <Skeleton height="4.5rem" />
      </div>
    );
  } else if (items.length === 0) {
    body = (
      <p className={styles.empty} role="status">
        <Icon name="info" size={18} />
        {t('goodTime.mobile.noBest', { count: days })}
      </p>
    );
  } else {
    const tz = response.location.timeZone;
    body = (
      <>
        <ol className={styles.bestList}>
          {shown.map((item, index) => {
            const time = format.range(item.segment.start, item.segment.end, tz, item.date);
            return (
              <li key={`${item.date}-${item.segment.start}`} data-status-tone={item.tone}>
                <button
                  type="button"
                  className={styles.bestOption}
                  aria-current={item === current || undefined}
                  aria-label={t('goodTime.mobile.viewTime', { date: format.date(item.date), time })}
                  onClick={() => onSelect(item.date, item.segment.start)}
                >
                  <span className={styles.rank} aria-hidden="true">
                    {index + 1}
                  </span>
                  <span className={styles.bestOptionBody}>
                    <span className={styles.strong}>{format.date(item.date)}</span>
                    <span className={styles.bestOptionTime}>{time}</span>
                    <span className={styles.toneText}>{item.segment.status.name}</span>
                  </span>
                  <Icon name="chevronRight" size={20} />
                </button>
              </li>
            );
          })}
        </ol>
        {items.length > BEST_SHOWN && (
          <Button
            variant="secondary"
            className={styles.viewAll}
            aria-expanded={all}
            onClick={() => setAll(!all)}
          >
            {t(all ? 'goodTime.mobile.showFewer' : 'goodTime.mobile.viewAll')}
            <Icon name={all ? 'chevronDown' : 'chevronRight'} size={18} />
          </Button>
        )}
      </>
    );
  }

  return (
    <section className={styles.card} aria-labelledby={titleId}>
      <div className={styles.cardHead}>
        <h2 id={titleId}>{t('goodTime.mobile.nextBest')}</h2>
        <SheetSelect
          size="compact"
          title={t('goodTime.mobile.range')}
          label={t('goodTime.mobile.range')}
          value={String(days)}
          options={RANGE_OPTIONS.map((option) => ({
            value: String(option),
            label: t('goodTime.mobile.nextBestRange', { count: option }),
          }))}
          onChange={(next) => onDaysChange(Number(next) as RangeDays)}
        />
      </div>
      <div aria-live="polite">{body}</div>
    </section>
  );
}

/**
 * The day at a glance: the activity's segments as a bar; opening it shows the same day cards as the Panchang page
 * (timeline, auspicious times, Panchang, times to avoid, why), loaded only when opened.
 */
function DayAtGlance({
  response,
  segments,
}: Readonly<{ response: GoodTimesResponse; segments: readonly ExplainedSegment[] }>) {
  const { t } = useTranslation();
  const format = useFormatters();
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const day = useDayPanchang(response.date, open);
  const { location } = useLocationState();
  const tz = response.location.timeZone;
  const first = segments[0];
  const last = segments.at(-1);
  const span = first && last ? Date.parse(last.segment.end) - Date.parse(first.segment.start) : 0;

  return (
    <section className={styles.card} aria-labelledby="day-at-glance-title">
      <h2 id="day-at-glance-title" className={styles.glanceHeading}>
        <button
          type="button"
          className={styles.glanceToggle}
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen(!open)}
        >
          {t('goodTime.mobile.dayAtGlance')}
          <Icon name={open ? 'chevronDown' : 'chevronRight'} size={20} />
        </button>
      </h2>
      {span > 0 && !open && (
        <div className={styles.glanceBar} aria-hidden="true">
          {segments.map((item) => (
            <span
              key={item.segment.id}
              data-status-tone={item.tone}
              data-good={item.segment.isGoodTime || undefined}
              style={{
                inlineSize: `${((Date.parse(item.segment.end) - Date.parse(item.segment.start)) / span) * 100}%`,
              }}
            />
          ))}
        </div>
      )}
      {!open && <p className={styles.muted}>{t('goodTime.mobile.dayAtGlanceHint')}</p>}
      <div id={panelId} hidden={!open} className={styles.glanceBody}>
        {open &&
          (day.query.isError ? (
            <>
              <p className={styles.strong}>{t('goodTime.mobile.dayAtGlanceError')}</p>
              <ErrorState
                error={day.query.error}
                onRetry={() => void day.query.refetch()}
                retrying={day.query.isFetching}
              />
            </>
          ) : !day.dashboard ? (
            <div role="status" className={styles.results}>
              <span className="visually-hidden">{t('goodTime.mobile.dayAtGlanceLoading')}</span>
              <Skeleton height="6rem" />
              <Skeleton height="10rem" />
            </div>
          ) : (
            <>
              <DayTimeline
                timeline={day.dashboard.timeline}
                timeZone={tz}
                date={response.date}
                locationLabel={location?.label ?? ''}
                compact
              />
              <PeriodList
                id="good-time-auspicious"
                tone="favorable"
                title={t('dashboard.auspiciousTitle', { day: format.day(response.date) })}
                subtitle={t('dashboard.auspiciousSubtitle')}
                items={day.dashboard.auspicious}
                glossary={day.glossary}
                timeZone={tz}
                date={response.date}
              />
              <MobileDayDetails dashboard={day.dashboard} glossary={day.glossary} timeZone={tz} />
            </>
          ))}
      </div>
    </section>
  );
}
