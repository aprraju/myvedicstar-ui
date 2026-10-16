import { zodResolver } from '@hookform/resolvers/zod';
import {
  type ContactForm,
  contactFormSchema,
  type ContactReason,
  contactReasons,
} from '@myvedicstar/validation';
import { useMutation } from '@tanstack/react-query';
import { useEffect, useId, useRef } from 'react';
import { type Resolver, useForm } from 'react-hook-form';
import { useSearchParams } from 'react-router';

import { displayNameOf, useAuth, useUserInfo } from '../../shared/auth';
import { Button } from '../../shared/components/Button';
import { Icon } from '../../shared/components/Icon';
import { ErrorState } from '../../shared/components/states';
import { useTranslation } from '../../shared/i18n/I18nProvider';
import { useServices } from '../../shared/services/ServicesContext';
import styles from './ContactPage.module.css';

type ContactFormInput = {
  name: string;
  email: string;
  reason: ContactReason | '';
  message: string;
  subject: string;
  phoneNumber: string;
};

/** The footer's Beta Feedback / Report an Issue / Contact buttons open this page with the matching reason. */
const FORM_TITLES = {
  feedback: { title: 'contact.forms.feedback.title', intro: 'contact.forms.feedback.intro' },
  technical: { title: 'contact.forms.issue.title', intro: 'contact.forms.issue.intro' },
} as const;

/**
 * Contact Us: a small form (name, email, reason, message) instead of publishing an email address. Signed-in users get
 * their name and email prefilled from their profile; `?reason=` preselects the reason (`feedback` for Beta Feedback,
 * `technical` for Report an Issue), and those two get their own title. Submits to `POST /email/send`; on success the
 * form is replaced by a confirmation. A different `?reason=` starts a fresh form.
 */
export function ContactPage() {
  const [searchParams] = useSearchParams();
  return <ContactForm key={searchParams.get('reason') ?? ''} />;
}

function ContactForm() {
  const { t, tDynamic } = useTranslation();
  const { api } = useServices();
  const { user } = useAuth();
  const { userInfo } = useUserInfo();
  const [searchParams] = useSearchParams();
  const ids = {
    name: useId(),
    email: useId(),
    reason: useId(),
    message: useId(),
    subject: useId(),
    phoneNumber: useId(),
  };
  const confirmationRef = useRef<HTMLHeadingElement>(null);

  const requested = searchParams.get('reason');
  const heading = requested === 'feedback' || requested === 'technical' ? FORM_TITLES[requested] : undefined;
  const form = useForm<ContactFormInput, unknown, ContactForm>({
    // The form holds '' until a reason is chosen; the schema rejects it on submit ("Choose a reason").
    resolver: zodResolver(contactFormSchema) as unknown as Resolver<ContactFormInput, unknown, ContactForm>,
    defaultValues: {
      name: '',
      email: '',
      subject: '',
      phoneNumber: '',
      reason: contactReasons.find((reason) => reason === requested) ?? '',
      message: '',
    },
  });

  // Prefill from the signed-in user's profile (login response), falling back to the sign-in token's name and email, without
  // overwriting anything already typed. Applies to Contact Us, Report an Issue and Beta Feedback alike.
  const profileName = displayNameOf(userInfo, user?.displayName);
  const profileEmail = userInfo?.email?.trim() || user?.email?.trim() || undefined;
  useEffect(() => {
    if (profileName && !form.getValues('name')) form.setValue('name', profileName);
    if (profileEmail && !form.getValues('email')) form.setValue('email', profileEmail);
  }, [profileName, profileEmail, form]);

  const submit = useMutation({ mutationFn: (values: ContactForm) => api.contact.submit(values) });

  useEffect(() => {
    if (submit.isSuccess) confirmationRef.current?.focus();
  }, [submit.isSuccess]);

  const errorText = (field: keyof ContactFormInput) => {
    const message = form.formState.errors[field]?.message;
    return message ? tDynamic(`validation.${message}`, undefined, t('errors.validation')) : undefined;
  };

  if (submit.isSuccess) {
    return (
      <section className={styles.page} aria-labelledby="contact-done">
        <div className={styles.card} role="status">
          <span className={styles.doneIcon} aria-hidden="true">
            <Icon name="check" size={28} />
          </span>
          <h1 id="contact-done" className={styles.title} tabIndex={-1} ref={confirmationRef}>
            {t('contact.submittedTitle')}
          </h1>
          <p className={styles.done}>{t('contact.submitted')}</p>
          <Button
            variant="secondary"
            onClick={() => {
              submit.reset();
              form.reset({ ...form.getValues(), reason: '', message: '' });
            }}
          >
            {t('contact.sendAnother')}
          </Button>
        </div>
      </section>
    );
  }

  const field = (name: keyof ContactFormInput) => {
    const error = errorText(name);
    return {
      id: ids[name],
      'aria-invalid': error ? true : undefined,
      'aria-describedby': error ? `${ids[name]}-error` : undefined,
      error,
    };
  };
  const name = field('name');
  const email = field('email');
  const reason = field('reason');
  const message = field('message');
  const subject = field('subject');
  const phoneNumber = field('phoneNumber');

  return (
    <section className={styles.page} aria-labelledby="contact-title">
      <div className={styles.card}>
        <h1 id="contact-title" className={styles.title}>
          {t(heading?.title ?? 'pages.contact.title')}
        </h1>
        <p className={styles.intro}>{t(heading?.intro ?? 'contact.intro')}</p>

        {submit.isError && (
          <div className={styles.error}>
            <p role="alert" className={styles.errorTitle}>
              {t('contact.errorTitle')}
            </p>
            <ErrorState error={submit.error} />
          </div>
        )}

        <form
          className={styles.form}
          noValidate
          onSubmit={form.handleSubmit((values) => {
            if (!submit.isPending) submit.mutate(values);
          })}
        >
          <div className={styles.field}>
            <label htmlFor={name.id} className={styles.label}>
              {t('contact.name')}
            </label>
            <input
              id={name.id}
              className={styles.input}
              autoComplete="name"
              maxLength={100}
              aria-invalid={name['aria-invalid']}
              aria-describedby={name['aria-describedby']}
              {...form.register('name')}
            />
            {name.error && (
              <p id={`${name.id}-error`} className={styles.fieldError}>
                {name.error}
              </p>
            )}
          </div>

          <div className={styles.field}>
            <label htmlFor={email.id} className={styles.label}>
              {t('contact.email')}
            </label>
            <input
              id={email.id}
              className={styles.input}
              type="email"
              inputMode="email"
              autoComplete="email"
              maxLength={254}
              aria-invalid={email['aria-invalid']}
              aria-describedby={`${email.id}-hint${email.error ? ` ${email.id}-error` : ''}`}
              {...form.register('email')}
            />
            <p id={`${email.id}-hint`} className={styles.hint}>
              {t('contact.emailHint')}
            </p>
            {email.error && (
              <p id={`${email.id}-error`} className={styles.fieldError}>
                {email.error}
              </p>
            )}
          </div>

          <div className={styles.field}>
            <label htmlFor={phoneNumber.id} className={styles.label}>
              {t('contact.phoneNumber')}
            </label>
            <input
              id={phoneNumber.id}
              className={styles.input}
              type="tel"
              autoComplete="tel"
              maxLength={40}
              aria-invalid={phoneNumber['aria-invalid']}
              aria-describedby={phoneNumber['aria-describedby']}
              {...form.register('phoneNumber')}
            />
            {phoneNumber.error && (
              <p id={`${phoneNumber.id}-error`} className={styles.fieldError}>
                {phoneNumber.error}
              </p>
            )}
          </div>

          <div className={styles.field}>
            <label htmlFor={reason.id} className={styles.label}>
              {t('contact.reason')}
            </label>
            <select
              id={reason.id}
              className={styles.input}
              aria-invalid={reason['aria-invalid']}
              aria-describedby={reason['aria-describedby']}
              {...form.register('reason')}
            >
              <option value="">{t('contact.reasonPlaceholder')}</option>
              {contactReasons.map((value) => (
                <option key={value} value={value}>
                  {t(`contact.reasons.${value}`)}
                </option>
              ))}
            </select>
            {reason.error && (
              <p id={`${reason.id}-error`} className={styles.fieldError}>
                {reason.error}
              </p>
            )}
          </div>

          <div className={styles.field}>
            <label htmlFor={subject.id} className={styles.label}>
              {t('contact.subject')}
            </label>
            <input
              id={subject.id}
              className={styles.input}
              maxLength={200}
              aria-invalid={subject['aria-invalid']}
              aria-describedby={subject['aria-describedby']}
              {...form.register('subject')}
            />
            {subject.error && (
              <p id={`${subject.id}-error`} className={styles.fieldError}>
                {subject.error}
              </p>
            )}
          </div>
          <div className={styles.field}>
            <label htmlFor={message.id} className={styles.label}>
              {t('contact.message')}
            </label>
            <textarea
              id={message.id}
              className={`${styles.input} ${styles.textarea}`}
              rows={6}
              maxLength={2000}
              aria-invalid={message['aria-invalid']}
              aria-describedby={`${message.id}-hint${message.error ? ` ${message.id}-error` : ''}`}
              {...form.register('message')}
            />
            <p id={`${message.id}-hint`} className={styles.hint}>
              {t('contact.messageHint')}
            </p>
            {message.error && (
              <p id={`${message.id}-error`} className={styles.fieldError}>
                {message.error}
              </p>
            )}
          </div>

          <Button type="submit" loading={submit.isPending} disabled={submit.isPending}>
            {t('contact.submit')}
          </Button>
        </form>
      </div>
    </section>
  );
}
