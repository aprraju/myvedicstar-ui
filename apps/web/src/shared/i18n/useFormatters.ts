import {
  formatDayMonth,
  formatLocalDate,
  formatRangeForDay,
  formatTime,
  type LocalDate,
} from '@myvedicstar/date-time';
import { useMemo } from 'react';

import { useTranslation } from './I18nProvider';

/**
 * Locale-aware formatting bound to the UI language. Every time is formatted in the *selected location's* zone —
 * never the device zone. The single place components get formatted dates and times from.
 */
export function useFormatters() {
  const { t, locale } = useTranslation();
  return useMemo(
    () => ({
      time: (instant: string, timeZone: string) => formatTime(instant, { timeZone, locale }),
      /** `3:10 PM – 4:39 PM`, with "(next day)" when an end falls after `referenceDate`. */
      range: (start: string, end: string, timeZone: string, referenceDate: LocalDate) =>
        formatRangeForDay(start, end, { timeZone, locale }, referenceDate, t('summary.nextDay')),
      date: (date: LocalDate) => formatLocalDate(date, locale),
      /** `October 14` — the day in card headings ("Times to avoid on October 14"). */
      day: (date: LocalDate) => formatDayMonth(date, locale),
      /** `Oct 5, 3:37 PM` in the given zone — for windows that can span days (festival Tithi, observance). */
      dateTime: (instant: string, timeZone: string) =>
        new Intl.DateTimeFormat(locale, {
          month: 'short',
          day: 'numeric',
          timeZone,
        }).format(new Date(instant)) +
        ', ' +
        formatTime(instant, { timeZone, locale }),
    }),
    [locale, t],
  );
}
