import { Link, Stack } from 'expo-router';

import { AppText, Screen } from '../src/shared/components';
import { useTranslation } from '../src/shared/i18n';

export default function NotFoundScreen() {
  const { t } = useTranslation();
  return (
    <>
      <Stack.Screen options={{ title: t('pages.notFound.title') }} />
      <Screen>
        <AppText variant="title">{t('pages.notFound.title')}</AppText>
        <AppText>{t('pages.notFound.body')}</AppText>
        <Link href="/" accessibilityRole="link">
          <AppText>{t('pages.notFound.action')}</AppText>
        </Link>
      </Screen>
    </>
  );
}
