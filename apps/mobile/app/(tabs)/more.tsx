import { ComingSoon } from '../../src/shared/components';
import { useTranslation } from '../../src/shared/i18n';

/** More: Full Panchang, Locations, Tradition, Notifications, Profile, Settings, Help (Phases 4–5). */
export default function MoreScreen() {
  const { t } = useTranslation();
  return <ComingSoon title={t('nav.more')} />;
}
