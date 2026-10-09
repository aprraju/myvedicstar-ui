import type { Glossary } from '@myvedicstar/contracts';
import type { DayDashboard, ElementNow, LimbKey } from '@myvedicstar/domain-models';
import type { MessageKey } from '@myvedicstar/localization';

import { Icon, type IconName } from '../../shared/components/Icon';
import { useTranslation } from '../../shared/i18n/I18nProvider';
import { useFormatters } from '../../shared/i18n/useFormatters';
import styles from './DashboardPage.module.css';

const LIMBS: { key: LimbKey; icon: IconName; accent: string }[] = [
  { key: 'tithi', icon: 'moon', accent: 'orange' },
  { key: 'nakshatra', icon: 'star', accent: 'blue' },
  { key: 'yoga', icon: 'sparkle', accent: 'orange' },
  { key: 'karana', icon: 'clock', accent: 'teal' },
];

/**
 * "Today's Panchang": the five limbs in force now (with when each ends and what follows), Paksha, sunrise and sunset.
 * For another date (calendar) the limbs are those in force at its sunrise; pass a `title` for that context.
 */
export function PanchangPanel({
  dashboard,
  glossary,
  timeZone,
  title,
}: Readonly<{ dashboard: DayDashboard; glossary: Glossary; timeZone: string; title?: string }>) {
  const { t } = useTranslation();
  const format = useFormatters();
  /** Localized label from the backend glossary, falling back to the app catalog. */
  const label = (section: 'elements' | 'terms', key: string, fallback: MessageKey) =>
    glossary[section]?.[key]?.name ?? t(fallback);
  const meaning = (section: 'elements' | 'terms', key: string) =>
    glossary[section]?.[key]?.meaning ?? undefined;

  return (
    <section className={styles.panel} aria-labelledby="panchang-title">
      <div className={styles.panelHead}>
        <h2 id="panchang-title" className={styles.panelTitle}>
          {title ?? t('dashboard.panchangTitle')}
        </h2>
      </div>
      <dl className={styles.rows}>
        {LIMBS.map(({ key, icon, accent }) => (
          <LimbRow
            key={key}
            icon={icon}
            accent={accent}
            label={label('elements', key, `dashboard.limbs.${key}`)}
            hint={meaning('elements', key)}
            element={dashboard.limbs[key]}
            timeZone={timeZone}
          />
        ))}
        <Row
          icon="calendar"
          accent="green"
          label={label('terms', 'vara', 'dashboard.limbs.vara')}
          hint={meaning('terms', 'vara')}
          value={dashboard.weekdayName}
        />
        {dashboard.summary.paksha && (
          <Row
            icon="moon"
            accent="purple"
            label={t('dashboard.limbs.paksha')}
            value={t(`summary.paksha.${dashboard.summary.paksha}`)}
          />
        )}
        <Row
          icon="sun"
          accent="orange"
          label={label('terms', 'sunrise', 'dashboard.limbs.sunrise')}
          hint={meaning('terms', 'sunrise')}
          value={format.time(dashboard.sunrise, timeZone)}
        />
        <Row
          icon="sun"
          accent="blue"
          label={label('terms', 'sunset', 'dashboard.limbs.sunset')}
          hint={meaning('terms', 'sunset')}
          value={format.time(dashboard.sunset, timeZone)}
          detail={`${t('dashboard.nextSunrise')} ${format.time(dashboard.nextSunrise, timeZone)}`}
        />
      </dl>
    </section>
  );
}

function LimbRow({
  icon,
  accent,
  label,
  hint,
  element,
  timeZone,
}: Readonly<{
  icon: IconName;
  accent: string;
  label: string;
  hint: string | undefined;
  element: ElementNow | undefined;
  timeZone: string;
}>) {
  const { t } = useTranslation();
  const format = useFormatters();
  if (!element) return null;
  const until = t('dashboard.until', { time: format.time(element.current.end, timeZone) });
  const next = element.next ? ` · ${t('dashboard.thenNext', { name: element.next.name })}` : '';
  return (
    <Row
      icon={icon}
      accent={accent}
      label={label}
      hint={hint}
      value={element.current.name}
      detail={until + next}
    />
  );
}

function Row({
  icon,
  accent,
  label,
  hint,
  value,
  detail,
}: Readonly<{
  icon: IconName;
  accent: string;
  label: string;
  hint?: string | undefined;
  value: string;
  detail?: string | undefined;
}>) {
  return (
    <div className={styles.row}>
      <span className={styles.rowIcon} data-accent={accent} aria-hidden="true">
        <Icon name={icon} size={16} />
      </span>
      <dt className={styles.rowLabel} title={hint}>
        {label}
      </dt>
      <dd className={styles.rowValue}>
        <span className={styles.rowName}>{value}</span>
        {detail && <span className={styles.rowDetail}>{detail}</span>}
      </dd>
    </div>
  );
}
