import Ionicons from '@expo/vector-icons/Ionicons';
import { type ComponentProps, type ReactNode, useId } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  type TextInputProps,
  type TextProps,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useTranslation } from './i18n';
import { useTheme, weight } from './theme';

export type IconName = ComponentProps<typeof Ionicons>['name'];

/**
 * Screen container: safe areas (notches, gesture bars, insets reported around hinges), scrolling, and a readable max
 * width so content is not stretched edge-to-edge on tablets and unfolded foldables.
 */
export function Screen({ children }: { children: ReactNode }) {
  const theme = useTheme();
  return (
    <SafeAreaView
      edges={['left', 'right']}
      style={[styles.fill, { backgroundColor: theme.colors.background }]}
    >
      <ScrollView
        contentContainerStyle={[styles.content, { padding: theme.spacing.lg }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.readable}>{children}</View>
      </ScrollView>
    </SafeAreaView>
  );
}

/** Text that honours Dynamic Type / font scaling, capped so layouts stay usable. */
export function AppText({
  variant = 'body',
  style,
  ...rest
}: TextProps & { variant?: 'display' | 'title' | 'heading' | 'body' | 'secondary' | 'label' }) {
  const theme = useTheme();
  const variants = {
    display: {
      fontSize: theme.fontSize.xxl,
      fontWeight: weight(theme.fontWeight.bold),
      color: theme.colors.primary,
    },
    title: {
      fontSize: theme.fontSize.xl,
      fontWeight: weight(theme.fontWeight.bold),
      color: theme.colors.primary,
    },
    heading: {
      fontSize: theme.fontSize.lg,
      fontWeight: weight(theme.fontWeight.semibold),
      color: theme.colors.textPrimary,
    },
    body: { fontSize: theme.fontSize.md, color: theme.colors.textPrimary },
    secondary: { fontSize: theme.fontSize.md, color: theme.colors.textSecondary },
    label: {
      fontSize: theme.fontSize.sm,
      fontWeight: weight(theme.fontWeight.semibold),
      color: theme.colors.textPrimary,
    },
  } as const;
  const variantStyle = variants[variant];
  const isHeader = variant === 'display' || variant === 'title' || variant === 'heading';
  return (
    <Text
      maxFontSizeMultiplier={2}
      accessibilityRole={isHeader ? 'header' : undefined}
      style={[{ lineHeight: variantStyle.fontSize * theme.lineHeight.normal }, variantStyle, style]}
      {...rest}
    />
  );
}

/** Pressable button: 44pt+ target, busy state blocks repeat presses, icon optional (text always present). */
export function Button({
  label,
  onPress,
  variant = 'primary',
  icon,
  loading = false,
  disabled = false,
  accessibilityLabel,
}: {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost';
  icon?: IconName;
  loading?: boolean;
  disabled?: boolean;
  accessibilityLabel?: string;
}) {
  const theme = useTheme();
  const colors = {
    primary: { bg: theme.colors.primary, fg: theme.colors.onPrimary, border: theme.colors.primary },
    secondary: { bg: theme.colors.surface, fg: theme.colors.primary, border: theme.colors.borderStrong },
    ghost: { bg: 'transparent', fg: theme.colors.primary, border: 'transparent' },
  }[variant];
  const inactive = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: inactive, busy: loading }}
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        {
          minHeight: theme.touchTarget.minimum,
          backgroundColor: colors.bg,
          borderColor: colors.border,
          opacity: inactive ? 0.65 : pressed ? 0.85 : 1,
        },
      ]}
    >
      {loading ? (
        <ActivityIndicator color={colors.fg} />
      ) : (
        icon && <Ionicons name={icon} size={18} color={colors.fg} />
      )}
      <AppText style={{ color: colors.fg, fontWeight: weight(theme.fontWeight.semibold) }}>{label}</AppText>
    </Pressable>
  );
}

/** Labelled text input with hint and error announced to screen readers. */
export function TextField({
  label,
  hint,
  error,
  ...input
}: TextInputProps & { label: string; hint?: string | undefined; error?: string | undefined }) {
  const theme = useTheme();
  const id = useId();
  return (
    <View style={styles.field}>
      <AppText variant="label" nativeID={`${id}-label`}>
        {label}
      </AppText>
      <TextInput
        accessibilityLabel={label}
        accessibilityLabelledBy={`${id}-label`}
        accessibilityHint={hint}
        aria-invalid={error ? true : undefined}
        maxFontSizeMultiplier={2}
        placeholderTextColor={theme.colors.textSecondary}
        style={[
          styles.input,
          {
            minHeight: theme.touchTarget.minimum,
            borderColor: error ? theme.colors.error : theme.colors.borderStrong,
            backgroundColor: theme.colors.surface,
            color: theme.colors.textPrimary,
            borderRadius: theme.radius.md,
          },
        ]}
        {...input}
      />
      {hint && !error && <AppText variant="secondary">{hint}</AppText>}
      {error && (
        <AppText
          accessibilityRole="alert"
          accessibilityLiveRegion="polite"
          style={{ color: theme.colors.error }}
        >
          {error}
        </AppText>
      )}
    </View>
  );
}

/** Informational or error message with an icon — never color alone. */
export function Notice({ tone = 'info', children }: { tone?: 'info' | 'error'; children: string }) {
  const theme = useTheme();
  const fg = tone === 'error' ? theme.colors.error : theme.colors.info;
  const bg = tone === 'error' ? theme.colors.errorSurface : theme.colors.infoSurface;
  return (
    <View
      accessible
      accessibilityRole={tone === 'error' ? 'alert' : undefined}
      accessibilityLiveRegion="polite"
      style={[styles.notice, { backgroundColor: bg, borderRadius: theme.radius.md }]}
    >
      <Ionicons
        name={tone === 'error' ? 'alert-circle-outline' : 'information-circle-outline'}
        size={20}
        color={fg}
      />
      <AppText style={[styles.flex, { color: fg }]}>{children}</AppText>
    </View>
  );
}

/**
 * Modal sheet (page sheet on iOS, full-screen modal on Android). The platform provides the accessibility semantics,
 * back/escape handling and focus containment.
 */
export function Sheet({
  visible,
  title,
  onClose,
  children,
}: {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  const theme = useTheme();
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={[styles.fill, { backgroundColor: theme.colors.surfaceElevated }]}>
        <View style={[styles.sheetHeader, { padding: theme.spacing.lg, borderColor: theme.colors.border }]}>
          <AppText variant="title" style={styles.flex}>
            {title}
          </AppText>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('a11y.close')}
            onPress={onClose}
            hitSlop={8}
            style={[
              styles.close,
              { minWidth: theme.touchTarget.minimum, minHeight: theme.touchTarget.minimum },
            ]}
          >
            <Ionicons name="close" size={24} color={theme.colors.textSecondary} />
          </Pressable>
        </View>
        <ScrollView
          contentContainerStyle={[styles.sheetBody, { padding: theme.spacing.lg }]}
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets
          keyboardDismissMode="interactive"
        >
          <View style={styles.readable}>{children}</View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

/** Placeholder for screens delivered in later phases; clearly labelled, never an empty screen. */
export function ComingSoon({ title }: { title: string }) {
  const { t } = useTranslation();
  const theme = useTheme();
  return (
    <Screen>
      <AppText variant="display">{title}</AppText>
      <View
        style={[
          styles.card,
          {
            backgroundColor: theme.colors.surfaceSubtle,
            borderRadius: theme.radius.md,
            padding: theme.spacing.lg,
          },
        ]}
      >
        <AppText variant="secondary">{t('pages.comingSoon.body')}</AppText>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  flex: { flex: 1 },
  content: { flexGrow: 1, alignItems: 'center' },
  readable: { width: '100%', maxWidth: 720, gap: 16 },
  card: { marginTop: 8 },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
  },
  field: { gap: 6 },
  input: { borderWidth: 1, paddingHorizontal: 12, fontSize: 16 },
  notice: { flexDirection: 'row', gap: 8, padding: 12, alignItems: 'flex-start' },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth },
  close: { alignItems: 'center', justifyContent: 'center' },
  sheetBody: { alignItems: 'center' },
});
