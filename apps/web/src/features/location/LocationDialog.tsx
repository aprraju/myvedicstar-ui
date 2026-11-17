import { zodResolver } from '@hookform/resolvers/zod';
import { isApiError } from '@myvedicstar/api-client';
import { searchLocation, type SelectedLocation, toSelectedLocation } from '@myvedicstar/domain-models';
import type { MessageKey } from '@myvedicstar/localization';
import { coordinatesFormSchema } from '@myvedicstar/validation';
import { useMutation } from '@tanstack/react-query';
import { useId, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { Button } from '../../shared/components/Button';
import { Dialog } from '../../shared/components/Dialog';
import { Icon } from '../../shared/components/Icon';
import { ErrorState } from '../../shared/components/states';
import { useTranslation } from '../../shared/i18n/I18nProvider';
import { useServices } from '../../shared/services/ServicesContext';
import { LocationAutocomplete } from './LocationAutocomplete';
import styles from './LocationDialog.module.css';
import { type DetectError, useLocationState } from './LocationStateProvider';

/** The single location picker: current location, search, coordinates and recent locations. */
export function LocationDialog() {
  const { t } = useTranslation();
  const { config } = useServices();
  const { dialogOpen, closeDialog, savingError, retrySave } = useLocationState();
  return (
    <Dialog
      open={dialogOpen}
      onClose={closeDialog}
      title={t('location.dialogTitle')}
      description={t(config.locationSearch.enabled ? 'locationSearch.privacy' : 'location.privacy')}
    >
      <LocationDialogContent onDone={closeDialog} />
      {savingError && (
        <div role="alert">
          <p>Saved locations could not be updated. Your current selection is still available.</p>
          <Button onClick={retrySave}>Retry saved locations</Button>
        </div>
      )}
    </Dialog>
  );
}

function LocationDialogContent({ onDone }: { onDone: () => void }) {
  const { config } = useServices();
  const [hasSearch, setHasSearch] = useState(false);
  const { select, selectOverride } = useLocationState();
  const choose = (location: SelectedLocation) => {
    // A caller-supplied sink (e.g. a form capturing its own birth location) wins; otherwise this stays app-global.
    (selectOverride ?? select)(location);
    onDone();
  };
  return (
    <div className={styles.content}>
      <CurrentLocationButton onDone={onDone} />
      {config.locationSearch.enabled ? (
        <LocationAutocomplete onChoose={choose} onSearchChange={setHasSearch} />
      ) : (
        <LocationSearch onChoose={choose} />
      )}
      <CoordinatesForm onChoose={choose} />
      {!hasSearch && <RecentLocations onChoose={choose} />}
    </div>
  );
}

function CurrentLocationButton({ onDone }: { onDone: () => void }) {
  const { t } = useTranslation();
  const { detecting, detectError, detectCurrentLocation } = useLocationState();
  return (
    <div className={styles.section}>
      <Button
        variant="secondary"
        fullWidth
        loading={detecting}
        onClick={() => void detectCurrentLocation().then((ok) => ok && onDone())}
      >
        <Icon name="locate" />
        {detecting ? t('location.locating') : t('location.useCurrent')}
      </Button>
      {detectError && <LocationPermissionMessage error={detectError} />}
    </div>
  );
}

const GEO_MESSAGES: Record<Extract<DetectError, { kind: 'geolocation' }>['reason'], MessageKey> = {
  permissionDenied: 'location.errors.permissionDenied',
  unsupported: 'location.errors.unsupported',
  unavailable: 'location.errors.unavailable',
  timeout: 'location.errors.timeout',
};

function LocationPermissionMessage({ error }: { error: DetectError }) {
  const { t } = useTranslation();
  if (error.kind === 'api') return <ErrorState error={error.error} />;
  return (
    <p role="alert" className={styles.notice}>
      <Icon name="info" />
      <span>{t(GEO_MESSAGES[error.reason])}</span>
    </p>
  );
}

// Error messages are full localization keys.
const searchSchema = z.object({
  query: z.string().trim().min(1, { error: 'validation.location.input.required' }).max(120),
});

function LocationSearch({ onChoose }: { onChoose: (location: SelectedLocation) => void }) {
  const { t, tDynamic } = useTranslation();
  const { api } = useServices();
  const inputId = useId();
  const hintId = useId();
  const errorId = useId();
  const [result, setResult] = useState<SelectedLocation | null>(null);
  const form = useForm<z.input<typeof searchSchema>>({
    resolver: zodResolver(searchSchema),
    defaultValues: { query: '' },
  });

  const search = useMutation({
    mutationFn: (query: string) => searchLocation(query, (params) => api.locations.resolve(params)),
    onSuccess: (outcome) => {
      if (outcome.ok) {
        setResult(outcome.location);
        return;
      }
      setResult(null);
      form.setError('query', {
        message: outcome.reason === 'invalid' ? outcome.messageKey : 'location.errors.postalCodeUnsupported',
      });
    },
    onError: (error) => {
      setResult(null);
      if (isApiError(error) && error.kind === 'validation') {
        form.setError('query', { message: 'location.errors.notFound' });
      }
    },
  });

  const fieldError = form.formState.errors.query?.message;
  const fieldErrorText = fieldError ? tDynamic(fieldError, undefined, t('errors.validation')) : undefined;

  return (
    <div className={styles.section}>
      <form
        className={styles.searchForm}
        noValidate
        role="search"
        onSubmit={form.handleSubmit(({ query }) => search.mutate(query))}
      >
        <label htmlFor={inputId} className={`${styles.label} ${styles.phoneHidden}`}>
          {t('location.searchLabel')}
        </label>
        <p id={hintId} className={`${styles.hint} ${styles.phoneHidden}`}>
          {t('location.searchHint')}
        </p>
        <div className={styles.searchRow}>
          <input
            id={inputId}
            className={styles.input}
            type="search"
            placeholder={t('location.searchPlaceholder')}
            autoComplete="off"
            maxLength={120}
            aria-describedby={`${hintId}${fieldErrorText ? ` ${errorId}` : ''}`}
            aria-invalid={fieldErrorText ? true : undefined}
            {...form.register('query', { onChange: () => setResult(null) })}
          />
          <Button type="submit" loading={search.isPending}>
            <Icon name="search" />
            {t('location.search')}
          </Button>
        </div>
        {fieldErrorText && (
          <p id={errorId} role="alert" className={styles.error}>
            {fieldErrorText}
          </p>
        )}
      </form>
      {search.isError && !(isApiError(search.error) && search.error.kind === 'validation') && (
        <ErrorState error={search.error} onRetry={() => search.mutate(form.getValues('query'))} />
      )}
      {result && <LocationSearchResult location={result} onChoose={onChoose} />}
    </div>
  );
}

function LocationSearchResult({
  location,
  onChoose,
}: {
  location: SelectedLocation;
  onChoose: (location: SelectedLocation) => void;
}) {
  const { t } = useTranslation();
  return (
    <div className={styles.result} aria-live="polite">
      <Icon name="pin" />
      <div className={styles.resultText}>
        <p className={styles.resultName}>{location.fullName ?? location.label}</p>
        <p className={styles.hint}>{t('location.timeZone', { timeZone: location.timeZone })}</p>
      </div>
      <Button onClick={() => onChoose(location)}>{t('location.useThis')}</Button>
    </div>
  );
}

function CoordinatesForm({ onChoose }: { onChoose: (location: SelectedLocation) => void }) {
  const { t, tDynamic } = useTranslation();
  const { api, config, locationSearch } = useServices();
  const latId = useId();
  const lonId = useId();
  const form = useForm<
    z.input<typeof coordinatesFormSchema>,
    unknown,
    z.output<typeof coordinatesFormSchema>
  >({
    resolver: zodResolver(coordinatesFormSchema),
    defaultValues: { latitude: '', longitude: '' },
  });
  const resolve = useMutation({
    mutationFn: async (coordinates: z.output<typeof coordinatesFormSchema>) =>
      config.locationSearch.enabled
        ? locationSearch.resolveCoordinates(coordinates.latitude, coordinates.longitude, 'coordinates')
        : toSelectedLocation(await api.locations.resolve(coordinates), 'coordinates'),
    onSuccess: onChoose,
  });
  const errors = form.formState.errors;

  return (
    <details className={styles.details}>
      <summary className={styles.summary}>{t('location.coordinatesToggle')}</summary>
      <form
        className={styles.coordinates}
        noValidate
        onSubmit={form.handleSubmit((values) => resolve.mutate(values))}
      >
        {(['latitude', 'longitude'] as const).map((field) => {
          const id = field === 'latitude' ? latId : lonId;
          const message = errors[field]?.message;
          return (
            <div key={field} className={styles.field}>
              <label htmlFor={id} className={styles.label}>
                {t(`location.${field}`)}
              </label>
              <input
                id={id}
                className={styles.input}
                inputMode="decimal"
                autoComplete="off"
                maxLength={20}
                aria-invalid={message ? true : undefined}
                aria-describedby={message ? `${id}-error` : undefined}
                {...form.register(field)}
              />
              {message && (
                <p id={`${id}-error`} role="alert" className={styles.error}>
                  {tDynamic(`validation.${message}`, undefined, t('errors.validation'))}
                </p>
              )}
            </div>
          );
        })}
        <Button
          type="submit"
          variant="secondary"
          loading={resolve.isPending}
          className={styles.coordinatesSubmit}
        >
          {t('location.useCoordinates')}
        </Button>
        {resolve.isError && <ErrorState error={resolve.error} />}
      </form>
    </details>
  );
}

function RecentLocations({ onChoose }: { onChoose: (location: SelectedLocation) => void }) {
  const { t } = useTranslation();
  const { recent, removeRecent, location: selected } = useLocationState();
  const headingId = useId();
  return (
    <section className={styles.section} aria-labelledby={headingId}>
      <h3 id={headingId} className={styles.label}>
        {t('location.recent')}
      </h3>
      {recent.length === 0 ? (
        <p className={styles.hint}>{t('location.noRecent')}</p>
      ) : (
        <ul className={styles.recentList}>
          {recent.map((location) => (
            <li key={location.id} className={styles.recentItem}>
              <button
                type="button"
                className={styles.recentButton}
                aria-current={selected?.id === location.id ? 'true' : undefined}
                onClick={() => onChoose(location)}
              >
                <Icon name={location.source === 'current' ? 'locate' : 'pin'} />
                <span>{location.fullName ?? location.label}</span>
              </button>
              <button
                type="button"
                className={styles.removeButton}
                aria-label={t('location.removeRecent', { name: location.label })}
                onClick={() => removeRecent(location.id)}
              >
                <Icon name="trash" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
