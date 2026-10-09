import type { MessageKey } from '@myvedicstar/localization';

import { useTranslation } from '../../shared/i18n/I18nProvider';
import styles from './ContentPages.module.css';

const HELP_TOPICS = ['location', 'tradition', 'times', 'caution'] as const;

export function HelpPage() {
  const { t } = useTranslation();
  return (
    <article className={styles.article} aria-labelledby="help-title">
      <h1 id="help-title" className="page-title">
        {t('pages.help.title')}
      </h1>
      {HELP_TOPICS.map((topic) => (
        <section key={topic} className={styles.topic}>
          <h2 className={styles.question}>{t(`pages.help.${topic}Q` as MessageKey)}</h2>
          <p>{t(`pages.help.${topic}A` as MessageKey)}</p>
        </section>
      ))}
    </article>
  );
}
