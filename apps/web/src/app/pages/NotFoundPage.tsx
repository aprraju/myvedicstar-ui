import { Link } from 'react-router';

import { useTranslation } from '../../shared/i18n/I18nProvider';
import { routes } from '../../shared/routing/paths';

export function NotFoundPage() {
  const { t } = useTranslation();
  return (
    <section aria-labelledby="not-found-title" className="stack">
      <h1 id="not-found-title" className="page-title">
        {t('pages.notFound.title')}
      </h1>
      <p>{t('pages.notFound.body')}</p>
      <p>
        <Link to={routes.home}>{t('pages.notFound.action')}</Link>
      </p>
    </section>
  );
}
