import {
  countries,
  countryCodeFor,
  type SelectedLocation,
  suggestionLabel,
} from '@myvedicstar/domain-models';
import { useLocationAutocomplete, useLocationResolution } from '@myvedicstar/query-cache';
import { parseLocationInput } from '@myvedicstar/validation';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';

import { AppText, Button, Notice, TextField } from '../../shared/components';
import { errorMessageKey } from '../../shared/errors';
import { useTranslation } from '../../shared/i18n';
import { useServices } from '../../shared/services';
import { useTheme } from '../../shared/theme';

export function LocationAutocomplete({
  onChoose,
  onSearchChange,
}: {
  onChoose: (location: SelectedLocation) => void;
  onSearchChange: (hasText: boolean) => void;
}) {
  const { t, tDynamic, locale } = useTranslation();
  const { config, locationSearch } = useServices();
  const theme = useTheme();
  const [text, setText] = useState('');
  const [country, setCountry] = useState('');
  const [error, setError] = useState<string | undefined>();
  const countryCode = countryCodeFor(country, locale);
  const invalidCountry = country.trim() !== '' && !countryCode;
  const suggestions = useLocationAutocomplete(
    locationSearch,
    { ...config.locationSearch, enabled: !invalidCountry },
    text,
    countryCode,
    locale.split('-')[0] ?? 'en',
  );
  const resolution = useLocationResolution(locationSearch, onChoose);
  const countryOptions = useMemo(
    () =>
      country.trim() && !countryCode
        ? countries(locale)
            .filter((item) =>
              item.name.toLocaleLowerCase(locale).startsWith(country.trim().toLocaleLowerCase(locale)),
            )
            .slice(0, 5)
        : [],
    [country, countryCode, locale],
  );
  const change = (next: string) => {
    resolution.reset();
    setError(undefined);
    setText(next);
    onSearchChange(Boolean(next.trim()));
  };
  const submit = () => {
    resolution.reset();
    setError(undefined);
    const parsed = parseLocationInput(text);
    if (!parsed.ok) {
      setError(tDynamic(`validation.${parsed.error}`, undefined, t('errors.validation')));
      return;
    }
    if (invalidCountry) return;
    if (parsed.value.kind === 'coordinates')
      resolution.resolve({ latitude: parsed.value.latitude, longitude: parsed.value.longitude }, true);
    else void suggestions.refetch();
  };
  return (
    <View style={{ gap: theme.spacing.sm }}>
      <TextField
        label={t('location.searchLabel')}
        value={text}
        onChangeText={change}
        onSubmitEditing={submit}
        hint={t('location.searchHint')}
        error={error}
        returnKeyType="search"
        autoCorrect={false}
        maxLength={120}
      />
      <Button
        icon="search"
        label={t('location.search')}
        loading={suggestions.isFetching || resolution.isPending}
        onPress={submit}
      />
      {suggestions.isFetching && <ActivityIndicator accessibilityLabel={t('location.locating')} />}
      {suggestions.data?.map((place) => (
        <Pressable
          key={place.id}
          accessibilityRole="button"
          accessibilityLabel={suggestionLabel(place)}
          onPress={() => resolution.resolve({ suggestion: place })}
          style={({ pressed }) => ({
            padding: theme.spacing.md,
            borderRadius: theme.radius.md,
            backgroundColor: pressed ? theme.colors.surface : theme.colors.background,
            borderColor: theme.colors.border,
            borderWidth: 1,
          })}
        >
          <AppText>{suggestionLabel(place)}</AppText>
        </Pressable>
      ))}
      {suggestions.isSuccess && suggestions.data.length === 0 && text.trim() && (
        <Notice>{t('locationSearch.noResults')}</Notice>
      )}
      <TextField
        label={t('locationSearch.country')}
        placeholder={t('locationSearch.allCountries')}
        value={country}
        onChangeText={(next) => {
          resolution.reset();
          setCountry(next);
        }}
        hint={t('locationSearch.countryHint')}
        error={invalidCountry ? t('locationSearch.invalidCountry') : undefined}
        autoCorrect={false}
        maxLength={80}
      />
      {countryOptions.map((item) => (
        <Button
          key={item.code}
          variant="ghost"
          label={`${item.name} (${item.code})`}
          onPress={() => setCountry(item.code)}
        />
      ))}
      {text && <Button variant="ghost" label={t('locationSearch.clear')} onPress={() => change('')} />}
      {suggestions.isError && (
        <>
          <Notice tone="error">{t(errorMessageKey(suggestions.error))}</Notice>
          <Button label={t('states.retry')} onPress={() => void suggestions.refetch()} />
        </>
      )}
      {resolution.isError && <Notice tone="error">{t(errorMessageKey(resolution.error))}</Notice>}
      {resolution.data?.confirm && (
        <View style={{ gap: theme.spacing.sm }}>
          <AppText variant="heading">
            {resolution.data.location.fullName ?? resolution.data.location.label}
          </AppText>
          <AppText variant="secondary">
            {t('location.timeZone', { timeZone: resolution.data.location.timeZone })}
          </AppText>
          <Button
            label={t('location.useThis')}
            onPress={() => resolution.data && onChoose(resolution.data.location)}
          />
        </View>
      )}
      {parseLocationInput(text).ok && /\d/.test(text) && (
        <AppText variant="secondary">{t('locationSearch.postalCoverage')}</AppText>
      )}
    </View>
  );
}
