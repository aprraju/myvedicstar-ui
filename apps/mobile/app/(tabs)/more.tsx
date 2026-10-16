import { useLoginUserInfo } from '@myvedicstar/query-cache';
import { useRouter } from 'expo-router';

import { useAuth } from '../../src/shared/auth';
import { AppText, Button, Screen } from '../../src/shared/components';
import { useTranslation } from '../../src/shared/i18n';

/** More: Full Panchang, Locations, Tradition, Notifications, Profile, Settings, Help (Phases 4–5). */
export default function MoreScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { isAuthenticated, user, signOut } = useAuth();
  const userInfo = useLoginUserInfo(user?.id);
  return (
    <Screen>
      <AppText variant="title">{t('nav.more')}</AppText>
      <Button label="Contact Us" variant="secondary" onPress={() => router.push('/contact')} />
      <Button label="Feedback" variant="secondary" onPress={() => router.push('/contact?reason=feedback')} />
      <Button
        label="Report an Issue"
        variant="secondary"
        onPress={() => router.push('/contact?reason=technical')}
      />
      {isAuthenticated ? (
        <>
          {userInfo?.name && <AppText variant="heading">{userInfo.name}</AppText>}
          {userInfo?.email && <AppText>{userInfo.email}</AppText>}
          <Button label="Profile" variant="secondary" onPress={() => router.push('/profile')} />
          <Button label="Settings" variant="secondary" onPress={() => router.push('/settings')} />
          <Button label="Log out" variant="ghost" onPress={() => void signOut()} />
        </>
      ) : (
        <Button label="Sign in" onPress={() => router.push('/login')} />
      )}
    </Screen>
  );
}
