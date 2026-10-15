import { z } from 'zod';

/**
 * Contact form values. The API client maps the selected reason to the centralized email API's communication type.
 * Successful submission means the SMTP server accepted the message for delivery.
 */
export interface ContactRequest {
  name: string;
  email: string;
  reason: string;
  message: string;
  subject?: string;
  phoneNumber?: string;
}

/** Any (or no) acknowledgement body is accepted; nothing from it is displayed. */
export const contactResponseSchema = z.unknown();
