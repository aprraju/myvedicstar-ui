import { toAccountLocation, useAccountSettings, useSavedLocations } from '@myvedicstar/query-cache';
import { useState } from 'react';
import { View } from 'react-native';

import { useAuth } from '../../shared/auth';
import { AppText, Button, Notice, Screen } from '../../shared/components';
import { useServices } from '../../shared/services';
import { useLocationState } from '../location/LocationProvider';
import { useTradition, useTraditions } from '../tradition/TraditionProvider';

export function SettingsScreen() {
  const { user } = useAuth();
  return user ? (
    <SettingsForm key={user.id} userId={user.id} />
  ) : (
    <Screen>
      <Notice>Sign in to manage your settings.</Notice>
    </Screen>
  );
}
function SettingsForm({ userId }: { userId: string }) {
  const { api, config } = useServices();
  const { query, save } = useAccountSettings(api, userId);
  const locations = useSavedLocations(api, userId);
  const traditions = useTraditions();
  const { applyDefault: applyLocation, openSheet } = useLocationState();
  const { applyDefault: applyTradition } = useTradition();
  const [edits, setEdits] = useState<{ tradition?: string; location?: string }>({});
  const data = query.data;
  const selectedLocation = edits.location ?? data?.defaultLocationId ?? '';
  const busy = save.isPending || locations.remove.isPending;
  return (
    <Screen>
      <AppText variant="title">Settings</AppText>
      <AppText>Save defaults for future sign-ins. Temporary choices do not change these preferences.</AppText>
      {query.isPending && <AppText accessibilityLiveRegion="polite">Loading settings…</AppText>}
      {query.isError && (
        <>
          <Notice tone="error">Settings could not be loaded.</Notice>
          <Button label="Try again" onPress={() => void query.refetch()} />
        </>
      )}
      <AppText variant="heading">Default Tradition</AppText>
      <View accessibilityRole="radiogroup">
        {[{ key: '', name: 'Use application default' }, ...(traditions.data?.traditions ?? [])].map(
          (item) => (
            <Button
              key={item.key}
              variant={
                (edits.tradition ?? data?.defaultTradition ?? '') === item.key ? 'primary' : 'secondary'
              }
              disabled={busy || !data}
              label={item.name}
              onPress={() => {
                save.reset();
                setEdits((current) => ({ ...current, tradition: item.key }));
              }}
            />
          ),
        )}
      </View>
      <AppText variant="heading">Default Location</AppText>
      <Button
        label="Use existing location fallback"
        variant={!selectedLocation ? 'primary' : 'secondary'}
        disabled={busy || !data}
        onPress={() => setEdits((current) => ({ ...current, location: '' }))}
      />
      {locations.query.data?.map((item) => (
        <Button
          key={item.locationId}
          label={toAccountLocation(item).label}
          variant={selectedLocation === item.locationId ? 'primary' : 'secondary'}
          disabled={busy || !data}
          onPress={() => {
            save.reset();
            setEdits((current) => ({ ...current, location: item.locationId }));
          }}
        />
      ))}
      {save.isError && (
        <Notice tone="error">Settings could not be saved. Reload if another session changed them.</Notice>
      )}
      {save.isSuccess && <Notice>Your settings have been saved.</Notice>}
      <Button
        label="Save"
        loading={save.isPending}
        disabled={busy || !data}
        onPress={() => {
          if (!data || busy) return;
          save.mutate(
            {
              defaultTradition: (edits.tradition ?? data.defaultTradition) || null,
              defaultLocationId: selectedLocation || null,
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
      />
      <AppText variant="heading">Saved Locations</AppText>
      <Button label="Add location" variant="secondary" onPress={openSheet} />
      {(locations.query.isError || locations.remove.isError) && (
        <>
          <Notice tone="error">Saved locations could not be updated.</Notice>
          <Button label="Reload locations" onPress={() => void locations.query.refetch()} />
        </>
      )}
      {locations.query.isSuccess && !locations.query.data.length && (
        <AppText>No saved locations yet.</AppText>
      )}
      {locations.query.data?.map((item) => (
        <View key={item.locationId}>
          <AppText>
            {toAccountLocation(item).label}
            {data?.defaultLocationId === item.locationId ? ' — Default; deleting restores the fallback' : ''}
          </AppText>
          <Button
            label={`Delete ${toAccountLocation(item).label}`}
            variant="ghost"
            disabled={busy}
            onPress={() =>
              locations.remove.mutate(item.locationId, {
                onSuccess: () => {
                  if (data?.defaultLocationId === item.locationId) {
                    setEdits((current) => ({ ...current, location: '' }));
                    applyLocation(null);
                  }
                },
              })
            }
          />
        </View>
      ))}
    </Screen>
  );
}
