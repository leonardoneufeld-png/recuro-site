import { STRINGS } from './strings.js';

// Fill these in before launch; tools/check-launch.mjs refuses to pass while they are placeholders.
export const BOOKING_URL = ''; // e.g. https://cal.com/<user>/30min
export const CONTACT_EMAIL = 'TODO@recuro.ch';

// Only an https link on cal.com itself counts; anything else falls back to email.
export const isBookingLive = (url) => {
  try {
    const u = new URL(url);
    return u.protocol === 'https:' && u.hostname === 'cal.com';
  } catch {
    return false;
  }
};

export const bookingHref = (url, email, lang) => {
  if (isBookingLive(url)) return url;
  const subject = (STRINGS['book.subject'][lang] || STRINGS['book.subject'].en);
  return `mailto:${email}?subject=${encodeURIComponent(subject)}`;
};
