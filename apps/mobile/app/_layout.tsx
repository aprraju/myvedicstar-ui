import { createTranslator } from '@myvedicstar/localization';
import { type ErrorBoundaryProps, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppProviders } from '../src/app/AppProviders';
import { readMobileConfig } from '../src/app/config';
import { AppText } from '../src/shared/components';
import { useTranslation } from '../src/shared/i18n';
import { createMobileServices, type MobileServices, useServices } from '../src/shared/services';
import { useTheme } from '../src/shared/theme';

// Completes an authentication session opened in the system browser (required on web; harmless natively).
WebBrowser.maybeCompleteAuthSession();

export default function RootLayout() {
  const [services] = useState<MobileServices | null>(() => {
    const result = readMobileConfig();
    return result.ok ? createMobileServices(result.config) : null;
  });

  if (!services) return <StartupError />;

  return (
    <AppProviders services={services}>
      <ThemedStack />
    </AppProviders>
  );
}

function ThemedStack() {
  const theme = useTheme();
  const { t } = useTranslation();
  return (
    <>
      <StatusBar style={theme.dark ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: theme.colors.background },
        }}
      >
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          name="login"
          options={{ presentation: 'modal', headerShown: true, title: t('auth.login') }}
        />
        <Stack.Screen
          name="register"
          options={{ presentation: 'modal', headerShown: true, title: t('auth.register') }}
        />
      </Stack>
    </>
  );
}

/** Rendered by expo-router when a screen throws. Friendly text only; details go to telemetry. */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  return <ErrorScreen error={error} onRetry={retry} />;
}

function ErrorScreen({ error, onRetry }: { error: Error; onRetry: () => Promise<void> }) {
  const { t } = createTranslator('en');
  const theme = useTheme();
  const services = useOptionalServices();
  useEffect(() => {
    services?.telemetry.trackException(error, { source: 'ErrorBoundary' });
  }, [error, services]);

  return (
    <View style={[styles.center, { backgroundColor: theme.colors.background, padding: theme.spacing.xl }]}>
      <AppText variant="title">{t('errors.unexpected')}</AppText>
      <AppText variant="secondary">{t('errors.generic')}</AppText>
      <Pressable
        accessibilityRole="button"
        onPress={() => void onRetry()}
        style={[
          styles.button,
          { backgroundColor: theme.colors.primary, minHeight: theme.touchTarget.minimum },
        ]}
      >
        <AppText style={{ color: theme.colors.onPrimary }}>{t('states.retry')}</AppText>
      </Pressable>
    </View>
  );
}

function StartupError() {
  const { t } = createTranslator('en');
  return (
    <View style={styles.center}>
      <AppText variant="title">{t('app.name')}</AppText>
      <AppText accessibilityRole="alert">{t('errors.config')}</AppText>
    </View>
  );
}

function useOptionalServices(): MobileServices | null {
  try {
    return useServices();
  } catch {
    return null;
  }
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24 },
  button: { paddingHorizontal: 24, borderRadius: 999, justifyContent: 'center' },
});
