import { screen } from '@testing-library/react-native';

import { createInMemoryAuthClient } from '../../shared/auth';
import { AppText } from '../../shared/components';
import { hyderabad, renderApp, storeLocation } from '../../test/render';
import { useLocationState } from './LocationProvider';

const saved = (locationId: string, city: string, state: string, latitude: number, longitude: number) => ({
  locationId,
  city,
  state,
  country: city === 'Austin' ? 'United States' : 'India',
  countryCode: city === 'Austin' ? 'US' : 'IN',
  postalCode: null,
  latitude,
  longitude,
  timeZone: city === 'Austin' ? 'America/Chicago' : 'Asia/Kolkata',
});
const austin = saved('f85dddfa-2fb8-48c1-a3bf-36310c47f609', 'Austin', 'Texas', 30.2672, -97.7431);
const hyderabadSaved = saved(
  'e96544af-55b1-458b-92e0-33044c47ad28',
  'Hyderabad',
  'Telangana',
  17.385,
  78.4867,
);

function Probe() {
  const { location } = useLocationState();
  return <AppText>{`Location: ${location?.label ?? 'none'}`}</AppText>;
}

async function render(locations: (typeof austin)[], defaultLocation: typeof austin | null = null) {
  await renderApp(
    { probe: Probe },
    {
      auth: createInMemoryAuthClient({ user: { id: 'u1' } }),
      initialUrl: '/probe',
      fetchOverride: (url) =>
        url.pathname.endsWith('/settings')
          ? {
              status: 200,
              body: {
                defaultTradition: null,
                defaultLocationId: defaultLocation?.locationId ?? null,
                defaultLocation,
                revision: 1,
              },
            }
          : url.pathname.endsWith('/settings/locations')
            ? { status: 200, body: locations }
            : undefined,
    },
  );
}

describe('Location after login on mobile', () => {
  it('shows the default location', async () => {
    await render([hyderabadSaved, austin], austin);
    expect(await screen.findByText('Location: Austin, Texas, United States')).toBeTruthy();
  });
  it('shows the first saved location when no default is set', async () => {
    await storeLocation(hyderabad);
    await render([austin, hyderabadSaved]);
    expect(await screen.findByText('Location: Austin, Texas, United States')).toBeTruthy();
  });
  it('keeps the existing location without saved locations', async () => {
    await storeLocation(hyderabad);
    await render([]);
    expect(await screen.findByText(`Location: ${hyderabad.label}`)).toBeTruthy();
  });
});
