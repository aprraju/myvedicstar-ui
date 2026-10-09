import { ComingSoon } from '../../src/shared/components';
import { useTranslation } from '../../src/shared/i18n';

/** Festivals and observances (backend endpoints pending). */
export default function FestivalsScreen() {
  const { t } = useTranslation();
  return <ComingSoon title={t('nav.festivals')} />;
}
