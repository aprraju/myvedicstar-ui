import { type ProfileField, profileFields } from '@myvedicstar/contracts';
import { useProfileEditor, useProfileGeography } from '@myvedicstar/query-cache';
import { View } from 'react-native';

import { useAuth } from '../../shared/auth';
import { AppText, Button, Notice, Screen, TextField } from '../../shared/components';
import { useServices } from '../../shared/services';

export function ProfileScreen() {
  const { user } = useAuth();
  return user ? (
    <ProfileForm key={user.id} userId={user.id} />
  ) : (
    <Screen>
      <Notice>Sign in to manage your profile.</Notice>
    </Screen>
  );
}
function ProfileForm({ userId }: { userId: string }) {
  const { api, config } = useServices();
  const editor = useProfileEditor(api, userId);
  const { query, values, busy } = editor;
  const geo = useProfileGeography(
    api,
    values.country,
    values.state,
    values.city,
    values.postalCode,
    config.locationSearch.enabled,
  );
  return (
    <Screen>
      <AppText variant="title">Profile</AppText>
      {query.isPending && <AppText accessibilityLiveRegion="polite">Loading your profile…</AppText>}
      {query.isError && (
        <>
          <Notice tone="error">Your profile could not be loaded.</Notice>
          <Button label="Try again" onPress={() => void query.refetch()} />
        </>
      )}
      {(Object.entries(profileFields) as [ProfileField, string][]).map(([field, label]) => (
        <View key={field}>
          <TextField
            label={label}
            value={values[field]}
            editable={!busy && !!query.data}
            error={editor.errors[field]}
            onChangeText={(text) => editor.change(field, text)}
            keyboardType={
              field === 'email' ? 'email-address' : field === 'phoneNumber' ? 'phone-pad' : 'default'
            }
            autoCapitalize={field === 'email' ? 'none' : 'words'}
          />
          {field === 'country' &&
            geo.countries.data?.results
              .filter(
                (item) =>
                  values.country.length > 0 &&
                  (item.name.toLowerCase().includes(values.country.toLowerCase()) ||
                    item.code === values.country),
              )
              .slice(0, 8)
              .map((item) => (
                <Button
                  key={item.code}
                  variant="secondary"
                  disabled={busy}
                  label={item.name}
                  onPress={() => editor.change('country', item.code)}
                />
              ))}
          {field === 'state' &&
            geo.regions.data?.results
              .filter((item) => item.name.toLowerCase().includes(values.state.toLowerCase()))
              .slice(0, 8)
              .map((item) => (
                <Button
                  key={item.code}
                  variant="secondary"
                  disabled={busy}
                  label={item.name}
                  onPress={() => editor.change('state', item.name)}
                />
              ))}
          {(field === 'city' || field === 'postalCode') &&
            (field === 'city' ? geo.cities : geo.postal).data?.results.map((place) => (
              <Button
                key={place.id}
                variant="secondary"
                disabled={busy}
                label={[place.postalCode, place.city, place.region, place.country].filter(Boolean).join(', ')}
                onPress={() => editor.selectPlace(place)}
              />
            ))}
        </View>
      ))}
      {(geo.countries.isError || geo.regions.isError || geo.cities.isError || geo.postal.isError) && (
        <Notice>Address suggestions are unavailable. You can enter your address manually.</Notice>
      )}
      {(editor.save.isError || editor.sync.isError) && (
        <Notice tone="error">
          Changes could not be completed. Try again, or reload if your profile changed in another session.
        </Notice>
      )}
      {editor.save.isSuccess && !query.data?.nameSyncPending && <Notice>Your profile has been saved.</Notice>}
      {query.data?.nameSyncPending && (
        <>
          <Notice>Your profile is saved. Name synchronization is pending.</Notice>
          <Button
            label="Retry name synchronization"
            disabled={busy || editor.dirty}
            loading={editor.sync.isPending}
            onPress={() => editor.sync.mutate()}
          />
        </>
      )}
      <Button
        label="Save"
        disabled={busy || !query.data}
        loading={editor.save.isPending}
        onPress={editor.submit}
      />
    </Screen>
  );
}
