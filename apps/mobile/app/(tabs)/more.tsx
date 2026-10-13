import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';

import { useAuth } from '../../src/shared/auth';
import { AppText, Button, Screen } from '../../src/shared/components';
import { useTranslation } from '../../src/shared/i18n';
import { useServices } from '../../src/shared/services';

/** More: Full Panchang, Locations, Tradition, Notifications, Profile, Settings, Help (Phases 4–5). */
export default function MoreScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { isAuthenticated, user, signOut } = useAuth();
  const { api } = useServices();
  const { data: userInfo } = useQuery({
    queryKey: ['auth', 'userinfo', user?.id],
    queryFn: ({ signal }) => api.auth.userInfo({ signal }),
    enabled: isAuthenticated,
    staleTime: 60_000,
    retry: false,
  });
  return (
    <Screen>
      <AppText variant="title">{t('nav.more')}</AppText>
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
