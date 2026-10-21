// Who runs the service, and which version of the legal texts is current.
// Operator details come from the environment (see .env.example): they are legal facts only the
// owner can supply, so nothing is invented here. Empty values are simply not shown.
const env = process.env;

export const business = {
  name: env.REACT_APP_BUSINESS_NAME || '',
  address: env.REACT_APP_BUSINESS_ADDRESS || '',
  email: env.REACT_APP_CONTACT_EMAIL || '',
  registration: env.REACT_APP_BUSINESS_REGISTRATION || '',
  country: env.REACT_APP_BUSINESS_COUNTRY || '',
  // Name of the service that delivers your emails, listed in the Privacy Policy (e.g. Resend, Amazon SES, Zoho, Mailgun)
  emailProvider: env.REACT_APP_EMAIL_PROVIDER || '',
};

/** Minimum age to use the service (keep in step with MIN_AGE on the backend). */
export const MIN_AGE = Number(env.REACT_APP_MIN_AGE) || 16;

/** Bump both when the Terms or Privacy Policy change in a way people should re-accept. */
export const TERMS_VERSION = '2026-10';
export const LEGAL_UPDATED = '16 October 2026';

export const operatorName = business.name || 'Skepticall';
export const hasBusinessDetails = !!(business.name || business.address || business.email);
