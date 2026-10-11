import { countries, type SelectedLocation, suggestionLabel } from '@myvedicstar/domain-models';
import { useLocationAutocomplete, useLocationResolution } from '@myvedicstar/query-cache';
import { parseLocationInput } from '@myvedicstar/validation';
import { useId, useMemo, useState } from 'react';

import { Button } from '../../shared/components/Button';
import { ErrorState } from '../../shared/components/states';
import { useTranslation } from '../../shared/i18n/I18nProvider';
import { useServices } from '../../shared/services/ServicesContext';
import styles from './LocationDialog.module.css';

export function LocationAutocomplete({
  onChoose,
  onSearchChange,
}: {
  onChoose: (location: SelectedLocation) => void;
  onSearchChange: (hasText: boolean) => void;
}) {
  const { t, tDynamic, language, locale } = useTranslation();
  const { config, locationSearch } = useServices();
  const [text, setText] = useState('');
  const [country, setCountry] = useState('');
  const [open, setOpen] = useState(true);
  const [active, setActive] = useState(-1);
  const [error, setError] = useState<string | undefined>();
  const id = useId();
  const options = useMemo(() => countries(locale), [locale]);
  const search = useLocationAutocomplete(
    locationSearch,
    config.locationSearch,
    text,
    country || undefined,
    language,
  );
  const resolve = useLocationResolution(locationSearch, onChoose);
  const suggestions = search.data ?? [];
  const expanded = open && suggestions.length > 0 && Boolean(text.trim());
  const reset = () => {
    resolve.reset();
    setError(undefined);
    setActive(-1);
    setOpen(true);
  };
  const changeText = (value: string) => {
    reset();
    setText(value);
    onSearchChange(Boolean(value.trim()));
  };
  const submit = () => {
    reset();
    const parsed = parseLocationInput(text);
    if (!parsed.ok) {
      setError(tDynamic(`validation.${parsed.error}`, undefined, t('errors.validation')));
      return;
    }
    if (parsed.value.kind === 'coordinates')
      resolve.resolve({ latitude: parsed.value.latitude, longitude: parsed.value.longitude }, true);
    else void search.refetch();
  };

  return (
    <div className={styles.section}>
      <form
        role="search"
        className={styles.searchForm}
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <label htmlFor={id} className={styles.label}>
          {t('location.searchLabel')}
        </label>
        <div className={styles.searchRow}>
          <input
            id={id}
            className={styles.input}
            type="search"
            role="combobox"
            value={text}
            placeholder={t('location.searchPlaceholder')}
            autoComplete="off"
            maxLength={120}
            aria-autocomplete="list"
            aria-expanded={expanded}
            aria-controls={expanded ? `${id}-list` : undefined}
            aria-activedescendant={expanded && active >= 0 ? `${id}-option-${active}` : undefined}
            aria-describedby={`${id}-hint`}
            aria-invalid={Boolean(error)}
            onFocus={() => setOpen(true)}
            onChange={(event) => changeText(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                event.preventDefault();
                setOpen(false);
                setActive(-1);
              }
              if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                event.preventDefault();
                setOpen(true);
                if (suggestions.length)
                  setActive(
                    (current) =>
                      (current + (event.key === 'ArrowDown' ? 1 : -1) + suggestions.length) %
                      suggestions.length,
                  );
              }
              if (event.key === 'Enter' && expanded && active >= 0 && suggestions[active]) {
                event.preventDefault();
                resolve.resolve({ suggestion: suggestions[active] });
                setOpen(false);
              }
            }}
          />
          <Button type="submit" loading={search.isFetching || resolve.isPending}>
            {t('location.search')}
          </Button>
        </div>
        <p id={`${id}-hint`} className={styles.hint}>
          {t('location.searchHint')}
        </p>
        {expanded && (
          <ul
            id={`${id}-list`}
            className={styles.suggestions}
            role="listbox"
            aria-label={t('locationSearch.suggestions')}
          >
            {suggestions.map((suggestion, index) => (
              <li key={suggestion.id} role="presentation">
                <button
                  id={`${id}-option-${index}`}
                  type="button"
                  role="option"
                  aria-selected={active === index}
                  className={styles.suggestion}
                  tabIndex={-1}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => {
                    resolve.resolve({ suggestion });
                    setOpen(false);
                  }}
                >
                  {suggestionLabel(suggestion)}
                </button>
              </li>
            ))}
          </ul>
        )}
        <label htmlFor={`${id}-country`} className={styles.label}>
          {t('locationSearch.country')}
        </label>
        <select
          id={`${id}-country`}
          className={styles.input}
          value={country}
          onChange={(event) => {
            reset();
            setCountry(event.target.value);
          }}
        >
          <option value="">{t('locationSearch.allCountries')}</option>
          {options.map((option) => (
            <option key={option.code} value={option.code}>
              {option.name} ({option.code})
            </option>
          ))}
        </select>
        {text && (
          <Button type="button" variant="ghost" onClick={() => changeText('')}>
            {t('locationSearch.clear')}
          </Button>
        )}
      </form>
      {search.isFetching && (
        <p role="status" className={styles.hint}>
          {t('location.locating')}
        </p>
      )}
      {search.isSuccess && suggestions.length === 0 && text.trim() && (
        <p role="status" className={styles.hint}>
          {t('locationSearch.noResults')}
        </p>
      )}
      {parseLocationInput(text).ok && /\d/.test(text) && (
        <p className={styles.hint}>{t('locationSearch.postalCoverage')}</p>
      )}
      {error && (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      )}
      {search.isError && <ErrorState error={search.error} onRetry={() => void search.refetch()} />}
      {resolve.isError && <ErrorState error={resolve.error} />}
      {resolve.data?.confirm && (
        <div className={styles.result} aria-live="polite">
          <div className={styles.resultText}>
            <p className={styles.resultName}>
              {resolve.data.location.fullName ?? resolve.data.location.label}
            </p>
            <p className={styles.hint}>
              {t('location.timeZone', { timeZone: resolve.data.location.timeZone })}
            </p>
          </div>
          <Button onClick={() => resolve.data && onChoose(resolve.data.location)}>
            {t('location.useThis')}
          </Button>
        </div>
      )}
    </div>
  );
}
