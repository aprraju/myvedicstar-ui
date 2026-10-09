import { createTranslator } from '@myvedicstar/localization';

import styles from './ConfigErrorScreen.module.css';

/** Rendered when the app cannot start; it cannot rely on any provider, so it creates its own translator. */
export function ConfigErrorScreen() {
  const { t } = createTranslator('en');
  return (
    <main className={styles.screen}>
      <h1 className={styles.title}>{t('app.name')}</h1>
      <p role="alert">{t('errors.config')}</p>
      <button type="button" className={styles.button} onClick={() => window.location.reload()}>
        {t('errors.reload')}
      </button>
    </main>
  );
}
