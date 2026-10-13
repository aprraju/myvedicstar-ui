import Ionicons from '@expo/vector-icons/Ionicons';
import { isApiError } from '@myvedicstar/api-client';
import { searchLocation, type SelectedLocation, toSelectedLocation } from '@myvedicstar/domain-models';
import type { MessageKey } from '@myvedicstar/localization';
import { coordinatesFormSchema } from '@myvedicstar/validation';
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText, Button, Notice, Sheet, TextField } from '../../shared/components';
import { errorMessageKey } from '../../shared/errors';
import { useTranslation } from '../../shared/i18n';
import { useServices } from '../../shared/services';
import { useTheme } from '../../shared/theme';
import { LocationAutocomplete } from './LocationAutocomplete';
import { type DetectError, useLocationState } from './LocationProvider';

const GEO_MESSAGES: Record<Extract<DetectError, { kind: 'geolocation' }>['reason'], MessageKey> = {
  permissionDenied: 'location.errors.permissionDenied',
  unsupported: 'location.errors.unsupported',
  unavailable: 'location.errors.unavailable',
  timeout: 'location.errors.timeout',
};

export function LocationPermissionMessage({ error }: { error: DetectError }) {
  const { t } = useTranslation();
  if (error.kind === 'api') return <Notice tone="error">{t(errorMessageKey(error.error))}</Notice>;
  return <Notice>{t(GEO_MESSAGES[error.reason])}</Notice>;
}

/** The location picker: current location, search, coordinates and recent locations. */
export function LocationSheet() {
  const { t } = useTranslation();
  const { config } = useServices();
  const [hasSearch, setHasSearch] = useState(false);
  const close = () => {
    setHasSearch(false);
    closeSheet();
  };
  const { sheetOpen, closeSheet, select, savingError, retrySave } = useLocationState();
  const choose = (location: SelectedLocation) => {
    select(location);
    close();
  };
  return (
    <Sheet visible={sheetOpen} title={t('location.dialogTitle')} onClose={close}>
      <AppText variant="secondary">
        {t(config.locationSearch.enabled ? 'locationSearch.privacy' : 'location.privacy')}
      </AppText>
      <CurrentLocation onDone={close} />
      {config.locationSearch.enabled ? (
        sheetOpen && <LocationAutocomplete onChoose={choose} onSearchChange={setHasSearch} />
      ) : (
        <Search onChoose={choose} />
      )}
      {sheetOpen && <Coordinates onChoose={choose} />}
      {!hasSearch && <Recent onChoose={choose} />}
      {savingError && (
        <>
          <Notice tone="error">
            Saved locations could not be updated. Your current selection is still available.
          </Notice>
          <Button label="Retry saved locations" onPress={retrySave} />
        </>
      )}
    </Sheet>
  );
}

function CurrentLocation({ onDone }: { onDone: () => void }) {
  const { t } = useTranslation();
  const { detecting, detectError, detectCurrentLocation } = useLocationState();
  return (
    <View style={styles.section}>
      <Button
        variant="secondary"
        icon="locate-outline"
        label={detecting ? t('location.locating') : t('location.useCurrent')}
        loading={detecting}
        onPress={() => void detectCurrentLocation().then((ok) => ok && onDone())}
      />
      {detectError && <LocationPermissionMessage error={detectError} />}
    </View>
  );
}

function Search({ onChoose }: { onChoose: (location: SelectedLocation) => void }) {
  const { t, tDynamic } = useTranslation();
  const { api } = useServices();
  const [query, setQuery] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [result, setResult] = useState<SelectedLocation | null>(null);

  const search = useMutation({
    mutationFn: (text: string) => searchLocation(text, (params) => api.locations.resolve(params)),
    onSuccess: (outcome) => {
      if (outcome.ok) {
        setResult(outcome.location);
        return;
      }
      setResult(null);
      setError(
        outcome.reason === 'invalid'
          ? tDynamic(outcome.messageKey, undefined, t('errors.validation'))
          : t('location.errors.postalCodeUnsupported'),
      );
    },
    onError: (failure) => {
      setResult(null);
      setError(
        isApiError(failure) && failure.kind === 'validation'
          ? t('location.errors.notFound')
          : t(errorMessageKey(failure)),
      );
    },
  });

  const submit = () => {
    setError(undefined);
    search.mutate(query);
  };

  return (
    <View style={styles.section}>
      <TextField
        label={t('location.searchLabel')}
        hint={t('location.searchHint')}
        error={error}
        value={query}
        onChangeText={(text) => {
          setQuery(text);
          setResult(null);
        }}
        onSubmitEditing={submit}
        returnKeyType="search"
        autoCorrect={false}
        maxLength={120}
      />
      <Button icon="search" label={t('location.search')} loading={search.isPending} onPress={submit} />
      {result && (
        <View style={styles.result}>
          <AppText variant="heading">{result.fullName ?? result.label}</AppText>
          <AppText variant="secondary">{t('location.timeZone', { timeZone: result.timeZone })}</AppText>
          <Button label={t('location.useThis')} onPress={() => onChoose(result)} />
        </View>
      )}
    </View>
  );
}

function Coordinates({ onChoose }: { onChoose: (location: SelectedLocation) => void }) {
  const { t, tDynamic } = useTranslation();
  const { api, config, locationSearch } = useServices();
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState({ latitude: '', longitude: '' });
  const [errors, setErrors] = useState<{ latitude?: string; longitude?: string }>({});
  const resolve = useMutation({
    mutationFn: async (coordinates: { latitude: number; longitude: number }) =>
      config.locationSearch.enabled
        ? locationSearch.resolveCoordinates(coordinates.latitude, coordinates.longitude, 'coordinates')
        : toSelectedLocation(await api.locations.resolve(coordinates), 'coordinates'),
    onSuccess: onChoose,
  });

  const submit = () => {
    const parsed = coordinatesFormSchema.safeParse(values);
    if (!parsed.success) {
      const next: { latitude?: string; longitude?: string } = {};
      for (const issue of parsed.error.issues) {
        const field = issue.path[0];
        if (field === 'latitude' || field === 'longitude') {
          next[field] ??= tDynamic(`validation.${issue.message}`, undefined, t('errors.validation'));
        }
      }
      setErrors(next);
      return;
    }
    setErrors({});
    resolve.mutate(parsed.data);
  };

  return (
    <View style={styles.section}>
      <Button
        variant="ghost"
        icon={open ? 'chevron-up' : 'chevron-down'}
        label={t('location.coordinatesToggle')}
        onPress={() => setOpen((o) => !o)}
      />
      {open && (
        <>
          <TextField
            label={t('location.latitude')}
            keyboardType="numbers-and-punctuation"
            value={values.latitude}
            error={errors.latitude}
            maxLength={20}
            onChangeText={(latitude) => setValues((v) => ({ ...v, latitude }))}
          />
          <TextField
            label={t('location.longitude')}
            keyboardType="numbers-and-punctuation"
            value={values.longitude}
            error={errors.longitude}
            maxLength={20}
            onChangeText={(longitude) => setValues((v) => ({ ...v, longitude }))}
          />
          <Button
            variant="secondary"
            label={t('location.useCoordinates')}
            loading={resolve.isPending}
            onPress={submit}
          />
          {resolve.isError && <Notice tone="error">{t(errorMessageKey(resolve.error))}</Notice>}
        </>
      )}
    </View>
  );
}

function Recent({ onChoose }: { onChoose: (location: SelectedLocation) => void }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const { recent, removeRecent, location: selected } = useLocationState();
  return (
    <View style={styles.section}>
      <AppText variant="heading">{t('location.recent')}</AppText>
      {recent.length === 0 ? (
        <AppText variant="secondary">{t('location.noRecent')}</AppText>
      ) : (
        recent.map((location) => (
          <View key={location.id} style={styles.recentRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: selected?.id === location.id }}
              onPress={() => onChoose(location)}
              style={[styles.recentButton, { minHeight: theme.touchTarget.minimum }]}
            >
              <Ionicons
                name={location.source === 'current' ? 'locate-outline' : 'location-outline'}
                size={20}
                color={theme.colors.primary}
              />
              <AppText style={styles.flex}>{location.fullName ?? location.label}</AppText>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('location.removeRecent', { name: location.label })}
              onPress={() => removeRecent(location.id)}
              style={[
                styles.remove,
                { minWidth: theme.touchTarget.minimum, minHeight: theme.touchTarget.minimum },
              ]}
            >
              <Ionicons name="trash-outline" size={20} color={theme.colors.textSecondary} />
            </Pressable>
          </View>
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: 10 },
  result: { gap: 6, padding: 12, borderRadius: 10, borderWidth: StyleSheet.hairlineWidth },
  recentRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  recentButton: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  remove: { alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1 },
});
