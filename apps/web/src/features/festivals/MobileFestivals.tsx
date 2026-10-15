import type { Festival } from '@myvedicstar/contracts';
import { type ReactNode, useId, useState } from 'react';

import { Icon } from '../../shared/components/Icon';
import { SheetSelect } from '../../shared/components/SheetSelect';
import { useTranslation } from '../../shared/i18n/I18nProvider';
import { useFormatters } from '../../shared/i18n/useFormatters';
import styles from './MobileFestivals.module.css';

/**
 * Upcoming festivals and observances on phones (< 1024px): filter and range at the top, the next event highlighted,
 * then one card per event under its month. A card shows name, date, category and a one-line description; View details
 * reveals the timing exactly as the calculation engine returns it — the observance moment by its own name (Sunrise,
 * Aparahna, Pradosha, Nishita…) and the Tithi, Nakshatra or Sankranti it is based on — never a generic label.
 */
export function MobileFestivals<F extends string>({
  locationLabel,
  traditionName,
  timeZone,
  filters,
  show,
  onShow,
  ranges,
  days,
  onDays,
  festivals,
  months,
  state,
}: Readonly<{
  locationLabel: string;
  traditionName: string | undefined;
  timeZone: string;
  filters: readonly F[];
  show: F;
  onShow: (filter: F) => void;
  ranges: readonly number[];
  days: number;
  onDays: (days: number) => void;
  festivals: readonly Festival[] | undefined;
  months: readonly { key: string; title: string; items: readonly Festival[] }[];
  /** Loading, error or empty state, shown instead of the events. */
  state?: ReactNode;
}>) {
  const { t } = useTranslation();
  const rangeLabelId = useId();
  const next = festivals?.[0];

  return (
    <section className={styles.page} aria-labelledby="festivals-title">
      <header className={styles.head}>
        <h1 id="festivals-title">{t('festivals.title')}</h1>
        {traditionName && (
          <p className={styles.where}>
            <Icon name="pin" size={16} />
            {t('festivals.mobile.where', { location: locationLabel, tradition: traditionName })}
          </p>
        )}
      </header>

      <div className={styles.segmented} role="group" aria-label={t('festivals.filter')}>
        {filters.map((filter) => (
          <button key={filter} type="button" aria-pressed={show === filter} onClick={() => onShow(filter)}>
            {t(`festivals.filters.${filter}` as 'festivals.filters.all')}
          </button>
        ))}
      </div>

      <div className={styles.toolbar}>
        <p className={styles.muted} aria-live="polite">
          {festivals ? t('festivals.countLabel', { count: festivals.length }) : ''}
        </p>
        <div className={styles.range}>
          <span id={rangeLabelId} className={styles.muted}>
            {t('festivals.mobile.next')}
          </span>
          <SheetSelect
            size="compact"
            title={t('festivals.range')}
            labelledBy={rangeLabelId}
            value={String(days)}
            options={ranges.map((range) => ({
              value: String(range),
              label: t('festivals.rangeOption', { days: range }),
            }))}
            onChange={(value) => onDays(Number(value))}
          />
        </div>
      </div>

      {state}

      {!state && next && <NextEvent festival={next} timeZone={timeZone} />}

      {!state &&
        months.map(({ key, title, items }) => (
          <section key={key} className={styles.month} aria-labelledby={`month-${key}`}>
            <div className={styles.monthHead}>
              <h2 id={`month-${key}`}>{title}</h2>
              <span className={styles.muted}>{t('festivals.mobile.upcoming')}</span>
            </div>
            <ul className={styles.list}>
              {items.map((festival) => (
                <FestivalEventCard
                  key={`${festival.key}-${festival.date}`}
                  festival={festival}
                  timeZone={timeZone}
                />
              ))}
            </ul>
          </section>
        ))}
    </section>
  );
}

function When({ festival }: Readonly<{ festival: Festival }>) {
  const { t } = useTranslation();
  if (festival.daysFromToday === 0) return <>{t('festivals.today')}</>;
  if (festival.daysFromToday === 1) return <>{t('festivals.tomorrow')}</>;
  return <>{t('festivals.inDays', { count: festival.daysFromToday })}</>;
}

/** OCT / 17 / Sat, from the event's local date. */
function DateBlock({ date }: Readonly<{ date: string }>) {
  const { locale } = useTranslation();
  const instant = Date.parse(`${date}T00:00:00Z`);
  const part = (options: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat(locale, { ...options, timeZone: 'UTC' }).format(instant);
  return (
    <span className={styles.dateBlock} aria-hidden="true">
      <span className={styles.dateMonth}>{part({ month: 'short' })}</span>
      <span className={styles.dateDay}>{part({ day: 'numeric' })}</span>
      <span className={styles.dateWeekday}>{part({ weekday: 'short' })}</span>
    </span>
  );
}

/** "Coming up next": the first event, with the same expandable observance details as the cards. */
function NextEvent({ festival, timeZone }: Readonly<{ festival: Festival; timeZone: string }>) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  return (
    <section className={styles.next} aria-labelledby="festivals-next-title">
      <h2 id="festivals-next-title">
        <Icon name="calendar" size={20} />
        {t('festivals.mobile.comingUp')}
      </h2>
      <div className={styles.nextBody}>
        <DateBlock date={festival.date} />
        <div className={styles.nextText}>
          <p className={styles.name}>{festival.name}</p>
          <p className={styles.muted}>
            {festival.categoryName} • <When festival={festival} />
          </p>
          {festival.description && (
            <p className={open ? undefined : styles.oneLine}>{festival.description}</p>
          )}
        </div>
      </div>
      <EventDetails festival={festival} timeZone={timeZone} open={open} onToggle={() => setOpen(!open)} />
    </section>
  );
}

/**
 * An event as a card (date block, name, category, when, one-line description) with its observance details behind
 * View details. Used by the phone layout and, in a grid, by the desktop festivals page.
 */
export function FestivalEventCard({
  festival,
  timeZone,
  defaultOpen = false,
}: Readonly<{
  festival: Festival;
  timeZone: string;
  /** Start with the observance details shown (the desktop page); phones start collapsed. */
  defaultOpen?: boolean;
}>) {
  const format = useFormatters();
  const [open, setOpen] = useState(defaultOpen);
  return (
    <li className={styles.card} data-category={festival.category}>
      <div className={styles.cardMain}>
        <DateBlock date={festival.date} />
        <div className={styles.cardText}>
          <div className={styles.cardHead}>
            <h3 className={styles.name}>
              {festival.icon && <span aria-hidden="true">{festival.icon} </span>}
              {festival.name}
            </h3>
            <span className={styles.badge} data-category={festival.category}>
              {festival.categoryName}
            </span>
          </div>
          <p className={styles.muted}>
            <span className="visually-hidden">{format.date(festival.date)}, </span>
            <When festival={festival} />
          </p>
          {festival.description && (
            <p className={open ? undefined : styles.oneLine}>{festival.description}</p>
          )}
        </div>
      </div>
      <EventDetails festival={festival} timeZone={timeZone} open={open} onToggle={() => setOpen(!open)} />
    </li>
  );
}

/**
 * View details / Hide details, and the timing exactly as the calculation engine returns it: the observance moment by
 * its own name (Sunrise, Aparahna, Pradosha, Nishita…) and the Tithi, Nakshatra or Sankranti it is based on.
 */
function EventDetails({
  festival,
  timeZone,
  open,
  onToggle,
}: Readonly<{ festival: Festival; timeZone: string; open: boolean; onToggle: () => void }>) {
  const { t } = useTranslation();
  const format = useFormatters();
  const detailsId = useId();
  const { timing } = festival;
  // Days offset from the anchor day (Holi, Bhogi, Kanuma) have no observance window of their own.
  const observance =
    timing.observanceStart === null || timing.observanceEnd === null
      ? undefined
      : timing.observanceStart === timing.observanceEnd
        ? format.dateTime(timing.observanceStart, timeZone)
        : `${format.dateTime(timing.observanceStart, timeZone)} – ${format.dateTime(timing.observanceEnd, timeZone)}`;
  // The basis exactly as returned: a Sankranti instant, or the Tithi / Nakshatra window.
  const basis =
    timing.start === timing.end
      ? t('festivals.sankranti', { time: format.dateTime(timing.start, timeZone) })
      : t('festivals.basisWindow', {
          basis: timing.basis,
          start: format.dateTime(timing.start, timeZone),
          end: format.dateTime(timing.end, timeZone),
        });

  return (
    <>
      <button
        type="button"
        className={styles.toggle}
        aria-expanded={open}
        aria-controls={detailsId}
        onClick={onToggle}
      >
        {t(open ? 'festivals.mobile.hideDetails' : 'festivals.mobile.viewDetails')}
        <Icon name="chevronDown" size={18} />
      </button>
      <dl id={detailsId} className={styles.details} hidden={!open}>
        {observance && (
          <div>
            <Icon name="clock" size={18} />
            <dt>{t('festivals.mobile.observedAt', { moment: timing.observanceTimeName })}</dt>
            <dd>{observance}</dd>
          </div>
        )}
        <div>
          <Icon name="moon" size={18} />
          <dt>{t('festivals.mobile.basis', { basis: timing.basis })}</dt>
          <dd>{basis}</dd>
        </div>
      </dl>
    </>
  );
}
