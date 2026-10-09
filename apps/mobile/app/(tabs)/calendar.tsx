import { ComingSoon } from '../../src/shared/components';
import { useTranslation } from '../../src/shared/i18n';

/** Calendar: 10 days, month and year views (Phase 4). */
export default function CalendarScreen() {
  const { t } = useTranslation();
  return <ComingSoon title={t('nav.calendar')} />;
}
