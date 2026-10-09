import type { MessageKey } from '@myvedicstar/localization';

import { EmptyState } from '../../shared/components/states';
import { useTranslation } from '../../shared/i18n/I18nProvider';

/** Clearly labelled destination for routes whose feature ships in a later phase. */
export function ComingSoonPage({ titleKey }: { titleKey: MessageKey }) {
  const { t } = useTranslation();
  return (
    <section aria-labelledby="coming-soon-title">
      <h1 id="coming-soon-title" className="page-title">
        {t(titleKey)}
      </h1>
      <EmptyState
        title={t('pages.comingSoon.title', { feature: t(titleKey) })}
        body={t('pages.comingSoon.body')}
      />
    </section>
  );
}
