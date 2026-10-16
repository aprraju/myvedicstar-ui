import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { createInMemoryAuthClient } from '../../shared/auth';
import { renderApp } from '../../test/render';
import { ProfileScreen } from './ProfileScreen';

const profile = {
  id: 'u1',
  firstName: 'Raju',
  lastName: 'Bhupathi',
  displayName: 'Raju B',
  streetAddress: '1 Main Street',
  streetAddress2: null,
  country: 'US',
  state: 'Texas',
  city: 'Austin',
  postalCode: '78701',
  email: 'aprraju@gmail.com',
  phoneNumber: null,
  revision: 0,
  nameSyncPending: false,
};
describe('Profile on mobile', () => {
  it('prefills the existing account and saves the editor', async () => {
    const auth = createInMemoryAuthClient({ user: { id: 'u1' } });
    await renderApp(
      { profile: ProfileScreen },
      {
        auth,
        initialUrl: '/profile',
        fetchOverride: (url) =>
          url.pathname.endsWith('/auth/profile') ? { status: 200, body: profile } : undefined,
      },
    );
    await waitFor(() => expect(screen.getByLabelText('First Name')).toHaveProp('value', 'Raju'));
    expect(screen.getByLabelText('Display Name')).toHaveProp('value', 'Raju B');
    expect(screen.getByLabelText('Email')).toHaveProp('value', 'aprraju@gmail.com');
    await fireEvent.changeText(screen.getByLabelText('Street Address 2'), 'Apartment 2');
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Your profile has been saved.')).toBeTruthy();
  });
});
