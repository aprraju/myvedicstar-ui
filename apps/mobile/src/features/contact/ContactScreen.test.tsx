import { fireEvent, screen } from '@testing-library/react-native';

import { renderApp } from '../../test/render';
import { ContactScreen } from './ContactScreen';

describe('Contact on mobile', () => {
  it('allows an anonymous visitor to send feedback', async () => {
    await renderApp(
      { contact: ContactScreen },
      {
        initialUrl: '/contact',
        fetchOverride: (url) =>
          url.pathname.endsWith('/email/send')
            ? { status: 200, body: { success: true, message: 'Submitted' } }
            : undefined,
      },
    );
    await fireEvent.changeText(screen.getByLabelText('Name'), 'Asha');
    await fireEvent.changeText(screen.getByLabelText('Email'), 'asha@example.com');
    await fireEvent.changeText(screen.getByLabelText('Subject'), 'Calendar feedback');
    await fireEvent.changeText(screen.getByLabelText('Message'), 'Thank you for the calendar.');
    await fireEvent.press(screen.getByRole('button', { name: 'Feedback' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Submit' }));
    expect(await screen.findByText('Your message has been submitted successfully.')).toBeTruthy();
  });

  it('keeps user entries when the server cannot deliver the message', async () => {
    await renderApp(
      { contact: ContactScreen },
      {
        initialUrl: '/contact',
        fetchOverride: (url) =>
          url.pathname.endsWith('/email/send')
            ? { status: 503, body: { status: 503, title: 'Unavailable' } }
            : undefined,
      },
    );
    await fireEvent.changeText(screen.getByLabelText('Name'), 'Asha');
    await fireEvent.changeText(screen.getByLabelText('Email'), 'asha@example.com');
    await fireEvent.changeText(screen.getByLabelText('Subject'), 'Calendar question');
    await fireEvent.changeText(screen.getByLabelText('Message'), 'Please help with the calendar.');
    await fireEvent.press(screen.getByRole('button', { name: 'Submit' }));
    expect(await screen.findByText(/Your message could not be submitted/)).toBeTruthy();
    expect(screen.getByLabelText('Message')).toHaveProp('value', 'Please help with the calendar.');
  });
});
