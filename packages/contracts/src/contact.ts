import { z } from 'zod';

/**
 * Contact Us submission — `POST /api/v1/contact` (backend endpoint to be provided). The UI sends this body and treats any
 * 2xx response (typically 202 Accepted with an empty body) as success.
 */
export interface ContactRequest {
  name: string;
  email: string;
  reason: string;
  message: string;
}

/** Any (or no) acknowledgement body is accepted; nothing from it is displayed. */
export const contactResponseSchema = z.unknown();
