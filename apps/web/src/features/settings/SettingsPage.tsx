import { toAccountLocation, useAccountSettings, useSavedLocations } from '@myvedicstar/query-cache';
import { useState } from 'react';

import { useAuth } from '../../shared/auth';
import { Button } from '../../shared/components/Button';
import { useServices } from '../../shared/services/ServicesContext';
import { useLocationState } from '../location';
import styles from '../profile/ProfilePage.module.css';
import { useTradition } from '../tradition';
import { useTraditions } from '../tradition/TraditionStateProvider';

export function SettingsPage() {
  const { user } = useAuth();
  return <SettingsForm key={user?.id} userId={user?.id} />;
}
function SettingsForm({ userId }: { userId: string | undefined }) {
  const { api, config } = useServices();
  const { query, save } = useAccountSettings(api, userId);
  const locations = useSavedLocations(api, userId);
  const traditions = useTraditions();
  const { applyDefault: applyLocation, openDialog } = useLocationState();
  const { applyDefault: applyTradition } = useTradition();
  const [edits, setEdits] = useState<{ tradition?: string; location?: string }>({});
  const data = query.data;
  const busy = save.isPending || locations.remove.isPending;
  const defaultLocation = data?.defaultLocationId ?? '';
  const locationId = edits.location ?? defaultLocation;
  const validLocation = !locationId || locations.query.data?.some((item) => item.locationId === locationId);
  return (
    <section className={styles.page} aria-labelledby="settings-title">
      <div className={styles.card}>
        <h1 id="settings-title" className="page-title">
          Settings
        </h1>
        <p>Save defaults for future sign-ins. Temporary choices elsewhere do not change these preferences.</p>
        {query.isPending && <p role="status">Loading settings…</p>}
        {query.isError && (
          <div role="alert">
            <p>Settings could not be loaded.</p>
            <Button onClick={() => void query.refetch()}>Try again</Button>
          </div>
        )}
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (!data || busy || !validLocation) return;
            save.mutate(
              {
                defaultTradition: (edits.tradition ?? data.defaultTradition) || null,
                defaultLocationId: locationId || null,
                revision: data.revision,
              },
              {
                onSuccess: (result) => {
                  setEdits({});
                  applyTradition(result.defaultTradition ?? config.defaultTradition);
                  if (result.defaultLocation) applyLocation(toAccountLocation(result.defaultLocation));
                },
              },
            );
          }}
        >
          <fieldset className={styles.fields} disabled={!data || busy}>
            <div className={styles.field}>
              <label htmlFor="default-tradition">Default Tradition</label>
              <select
                id="default-tradition"
                value={edits.tradition ?? data?.defaultTradition ?? ''}
                onChange={(event) => {
                  save.reset();
                  setEdits((current) => ({ ...current, tradition: event.target.value }));
                }}
              >
                <option value="">Use application default</option>
                {traditions.data?.traditions.map((item) => (
                  <option key={item.key} value={item.key}>
                    {item.name}
                  </option>
                ))}
              </select>
            </div>
            <div className={styles.field}>
              <label htmlFor="default-location">Default Location</label>
              <select
                id="default-location"
                value={validLocation ? locationId : ''}
                onChange={(event) => {
                  save.reset();
                  setEdits((current) => ({ ...current, location: event.target.value }));
                }}
              >
                <option value="">Use existing location fallback</option>
                {locations.query.data?.map((item) => (
                  <option key={item.locationId} value={item.locationId}>
                    {toAccountLocation(item).label}
                  </option>
                ))}
              </select>
            </div>
          </fieldset>
          {!validLocation && (
            <p role="alert">The chosen location was removed. Choose another default location.</p>
          )}
          {traditions.isError && (
            <p role="alert">Traditions could not be loaded. Try again before changing the default.</p>
          )}
          {save.isError && (
            <p role="alert">Settings could not be saved. Reload settings if another session changed them.</p>
          )}
          {save.isSuccess && <p role="status">Your settings have been saved.</p>}
          <Button type="submit" loading={save.isPending} disabled={!data || busy || !validLocation}>
            Save
          </Button>
        </form>
        <h2>Saved Locations</h2>
        <Button variant="secondary" onClick={openDialog}>
          Add location
        </Button>
        {locations.query.isPending && <p role="status">Loading saved locations…</p>}
        {(locations.query.isError || locations.remove.isError) && (
          <div role="alert">
            <p>Saved locations could not be updated.</p>
            <Button onClick={() => void locations.query.refetch()}>Reload locations</Button>
          </div>
        )}
        {locations.query.isSuccess && locations.query.data.length === 0 && (
          <p>No saved locations yet. Add one using the location selector.</p>
        )}
        <ul>
          {locations.query.data?.map((item) => (
            <li key={item.locationId}>
              {toAccountLocation(item).label}
              {defaultLocation === item.locationId && (
                <span> — Default (deleting it restores the fallback)</span>
              )}
              <Button
                variant="ghost"
                disabled={busy}
                aria-label={`Delete ${toAccountLocation(item).label}`}
                onClick={() =>
                  locations.remove.mutate(item.locationId, {
                    onSuccess: () => {
                      if (defaultLocation === item.locationId) {
                        setEdits((current) => ({ ...current, location: '' }));
                        applyLocation(null);
                      }
                    },
                  })
                }
              >
                Delete
              </Button>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
