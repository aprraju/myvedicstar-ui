import { contactFormSchema, type ContactReason } from '@myvedicstar/validation';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { useAuth } from '../../shared/auth';
import { AppText, Button, Notice, Screen, TextField } from '../../shared/components';
import { useServices } from '../../shared/services';

export function ContactScreen() {
  const { api } = useServices();
  const { isAuthenticated, user } = useAuth();
  const params = useLocalSearchParams<{ reason?: string }>();
  // Name and email stay undefined until typed, so the profile prefills them (without copying it into state).
  const [typed, setValues] = useState({
    name: undefined as string | undefined,
    email: undefined as string | undefined,
    phoneNumber: '',
    subject: '',
    message: '',
    reason: (params.reason === 'feedback'
      ? 'feedback'
      : params.reason === 'technical'
        ? 'technical'
        : 'general') as ContactReason,
  });
  const [error, setError] = useState('');
  const profile = useQuery({
    queryKey: ['auth', 'userinfo', user?.id],
    queryFn: ({ signal }) => api.auth.userInfo({ signal }),
    enabled: isAuthenticated,
    staleTime: 60000,
    retry: false,
  });
  const values = {
    ...typed,
    name: typed.name ?? profile.data?.name ?? '',
    email: typed.email ?? profile.data?.email ?? '',
  };
  const submit = useMutation({ mutationFn: () => api.contact.submit(values) });
  const change = (key: keyof typeof typed, value: string) => setValues((old) => ({ ...old, [key]: value }));
  if (submit.isSuccess)
    return (
      <Screen>
        <AppText variant="title">Thank you</AppText>
        <Notice>Your message has been submitted successfully.</Notice>
        <Button
          label="Send another message"
          onPress={() => {
            submit.reset();
            setValues((old) => ({ ...old, subject: '', message: '' }));
          }}
        />
      </Screen>
    );
  return (
    <Screen>
      <AppText variant="title">Contact Us</AppText>
      <AppText>Send feedback, report an issue, or ask a question.</AppText>
      <Button
        label="Contact Us"
        variant={values.reason === 'general' ? 'primary' : 'secondary'}
        onPress={() => change('reason', 'general')}
      />
      <Button
        label="Feedback"
        variant={values.reason === 'feedback' ? 'primary' : 'secondary'}
        onPress={() => change('reason', 'feedback')}
      />
      <Button
        label="Report an Issue"
        variant={values.reason === 'technical' ? 'primary' : 'secondary'}
        onPress={() => change('reason', 'technical')}
      />
      <TextField
        label="Name"
        value={values.name}
        onChangeText={(value) => change('name', value)}
        maxLength={100}
        editable={!submit.isPending}
      />
      <TextField
        label="Email"
        value={values.email}
        onChangeText={(value) => change('email', value)}
        keyboardType="email-address"
        autoCapitalize="none"
        maxLength={254}
        editable={!submit.isPending}
      />
      <TextField
        label="Phone number (optional)"
        value={values.phoneNumber}
        onChangeText={(value) => change('phoneNumber', value)}
        keyboardType="phone-pad"
        maxLength={40}
        editable={!submit.isPending}
      />
      <TextField
        label="Subject"
        value={values.subject}
        onChangeText={(value) => change('subject', value)}
        maxLength={200}
        editable={!submit.isPending}
      />
      <TextField
        label="Message"
        value={values.message}
        onChangeText={(value) => change('message', value)}
        multiline
        maxLength={2000}
        editable={!submit.isPending}
      />
      {!!error && <Notice tone="error">{error}</Notice>}
      {submit.isError && (
        <Notice tone="error">
          Your message could not be submitted. Check your connection and try again. Your entries have been
          kept.
        </Notice>
      )}
      <Button
        label="Submit"
        loading={submit.isPending}
        onPress={() => {
          if (submit.isPending) return;
          const validation = contactFormSchema.safeParse(values);
          if (!validation.success) {
            setError(
              'Enter your name, a valid email, a subject, and a message of 10 to 2,000 characters. Check the optional phone number.',
            );
            return;
          }
          setError('');
          submit.mutate();
        }}
      />
    </Screen>
  );
}
