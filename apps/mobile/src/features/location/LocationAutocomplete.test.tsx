import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { renderApp } from '../../test/render';
import { LocationAutocomplete } from './LocationAutocomplete';

const india = { id: '1269843', city: 'Hyderabad', region: 'Telangana', country: 'India', countryCode: 'IN', postalCode: null, latitude: 17.385, longitude: 78.4867, source: 'city' };
const pakistan = { ...india, id: '1176734', region: 'Sindh', country: 'Pakistan', countryCode: 'PK' };

describe('mobile GeoNames autocomplete', () => {
  it('shows worldwide suggestions and selects by touch after resolving the timezone', async () => {
    const onChoose = jest.fn();
    const requests: URL[] = [];
    const Screen = () => <LocationAutocomplete onChoose={onChoose} onSearchChange={() => undefined} />;
    await renderApp({ index: Screen }, {
      configOverrides: { locationSearch: { enabled: true, debounceMs: 200 } },
      fetchOverride: (url) => {
        requests.push(url);
        return url.pathname.endsWith('/locations/search')
          ? { status: 200, body: { results: [india, pakistan] } }
          : url.pathname.endsWith('/locations/timezone') ? { status: 200, body: { timeZone: 'Asia/Kolkata' } } : undefined;
      },
    });
    await fireEvent.changeText(screen.getByLabelText('City, ZIP code or coordinates'), 'Hyderabad');
    const first = await screen.findByRole('button', { name: 'Hyderabad, Telangana, India' });
    expect(screen.getByRole('button', { name: 'Hyderabad, Sindh, Pakistan' })).toBeTruthy();
    expect(requests.some((url) => url.pathname.endsWith('/locations/timezone'))).toBe(false);
    await fireEvent.press(first);
    await waitFor(() => expect(onChoose).toHaveBeenCalledWith(expect.objectContaining({ latitude: 17.385, longitude: 78.4867, timeZone: 'Asia/Kolkata' })));
  });

  it('supports international postal codes, country filtering and clearing the search', async () => {
    const requests: URL[] = [];
    const Screen = () => <LocationAutocomplete onChoose={() => undefined} onSearchChange={() => undefined} />;
    await renderApp({ index: Screen }, {
      configOverrides: { locationSearch: { enabled: true, debounceMs: 200 } },
      fetchOverride: (url) => {
        requests.push(url);
        return url.pathname.endsWith('/locations/postal') ? { status: 200, body: { results: [{ ...india, id: 'postal-IN-110001', source: 'postal', postalCode: '110001' }] } } : undefined;
      },
    });
    await fireEvent.changeText(screen.getByLabelText('Country'), 'India');
    await fireEvent.changeText(screen.getByLabelText('City, ZIP code or coordinates'), '110001');
    expect(await screen.findByRole('button', { name: 'Hyderabad, Telangana, India, 110001' })).toBeTruthy();
    expect(requests.find((url) => url.pathname.endsWith('/locations/postal'))?.searchParams.get('country')).toBe('IN');
    await fireEvent.press(screen.getByRole('button', { name: 'Clear search' }));
    expect(screen.getByLabelText('City, ZIP code or coordinates').props.value).toBe('');
    expect(screen.queryByRole('button', { name: 'Hyderabad, Telangana, India, 110001' })).toBeNull();
  });
});
