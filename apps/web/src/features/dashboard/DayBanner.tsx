import type { DaySummary, SelectedLocation } from '@myvedicstar/domain-models';

import { displayNameOf, useAuth, useUserInfo } from '../../shared/auth';
import { useTranslation } from '../../shared/i18n/I18nProvider';
import { useFormatters } from '../../shared/i18n/useFormatters';
import styles from './DashboardPage.module.css';

export function DayBanner({ summary, location }: { summary: DaySummary; location: SelectedLocation }) {
  const { t } = useTranslation();
  const format = useFormatters();
  const { user } = useAuth();
  const { userInfo } = useUserInfo();
  const name = displayNameOf(userInfo, user?.displayName);
  return (
    <div className={styles.hero}>
      <p className={styles.greeting}>
        {name ? t('dashboard.greeting', { name }) : t('dashboard.greetingAnonymous')}
      </p>
      <p className={styles.title}>{format.date(summary.date)}</p>
      <p className={styles.meta}>
        {summary.paksha && <span>{t(`summary.paksha.${summary.paksha}`)}</span>}
        {summary.tithi && <span>{summary.tithi.current.name}</span>}
        <span>{location.label}</span>
      </p>
    </div>
  );
}
