import type { IdentityProvider } from '@myvedicstar/config';
import { sanitizeReturnPath } from '@myvedicstar/config';
import { loginHintFormSchema } from '@myvedicstar/validation';
import { type Href, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useAuth } from '../../shared/auth';
import { SignInCancelled } from '../../shared/auth/auth-client';
import { AppText, Button, Notice, Screen, TextField } from '../../shared/components';
import { useTranslation } from '../../shared/i18n';
import { useTheme } from '../../shared/theme';

const PROVIDER_ICONS = {
  google: 'logo-google',
  apple: 'logo-apple',
  facebook: 'logo-facebook',
} as const;

/**
 * Login / Register. Credentials are entered only at the identity provider (system browser), never in the app.
 * Only providers enabled by configuration are shown.
 */
export function AuthScreen({ intent }: { intent: 'login' | 'register' }) {
  const { t, tDynamic } = useTranslation();
  const theme = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ returnTo?: string }>();
  const returnTo = sanitizeReturnPath(params.returnTo, '/');
  const { enabled, isAuthenticated, providers, signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState<string | undefined>();
  const [pending, setPending] = useState<IdentityProvider | null>(null);
  const [failure, setFailure] = useState<'cancelled' | 'failed' | null>(null);

  useEffect(() => {
    if (isAuthenticated) router.replace(returnTo as Href);
  }, [isAuthenticated, returnTo, router]);

  const start = async (provider: IdentityProvider, loginHint?: string) => {
    setPending(provider);
    setFailure(null);
    try {
      await signIn({ intent, provider, loginHint });
    } catch (error) {
      setFailure(error instanceof SignInCancelled ? 'cancelled' : 'failed');
    } finally {
      setPending(null);
    }
  };

  const submitEmail = () => {
    const parsed = loginHintFormSchema.safeParse({ email });
    if (!parsed.success) {
      setEmailError(
        tDynamic(`validation.${parsed.error.issues[0]?.message ?? ''}`, undefined, t('errors.validation')),
      );
      return;
    }
    setEmailError(undefined);
    void start('email', parsed.data.email || undefined);
  };

  const isLogin = intent === 'login';
  const social = providers.filter((p): p is keyof typeof PROVIDER_ICONS => p !== 'email');

  return (
    <Screen>
      <AppText variant="display">{isLogin ? t('auth.welcomeBack') : t('auth.createAccount')}</AppText>
      <AppText variant="secondary">{isLogin ? t('auth.loginIntro') : t('auth.registerIntro')}</AppText>

      {failure && (
        <Notice tone="error">
          {failure === 'cancelled' ? t('auth.signInCancelled') : t('auth.signInFailed')}
        </Notice>
      )}

      {!enabled ? (
        <Notice>{t('auth.notConfigured')}</Notice>
      ) : (
        <View style={styles.form}>
          {providers.includes('email') && (
            <>
              <TextField
                label={t('auth.email')}
                hint={t('auth.emailHint')}
                error={emailError}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                textContentType="username"
                maxLength={254}
                onSubmitEditing={submitEmail}
              />
              <Button
                label={t('auth.continue')}
                loading={pending === 'email'}
                disabled={pending !== null && pending !== 'email'}
                onPress={submitEmail}
              />
            </>
          )}
          {providers.includes('email') && social.length > 0 && (
            <AppText variant="secondary" style={[styles.or, { color: theme.colors.textSecondary }]}>
              {t('auth.or')}
            </AppText>
          )}
          {social.map((provider) => (
            <Button
              key={provider}
              variant="secondary"
              icon={PROVIDER_ICONS[provider]}
              label={t('auth.continueWith', { provider: t(`auth.providers.${provider}`) })}
              loading={pending === provider}
              disabled={pending !== null && pending !== provider}
              onPress={() => void start(provider)}
            />
          ))}
        </View>
      )}

      {!isLogin && (
        <View style={styles.switch}>
          <AppText variant="secondary">{t('auth.haveAccount')}</AppText>
          <Button
            variant="ghost"
            label={t('auth.login')}
            onPress={() => router.replace({ pathname: '/login', params: { returnTo } } as Href)}
          />
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  form: { gap: 12 },
  or: { textAlign: 'center' },
  switch: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 4 },
});
