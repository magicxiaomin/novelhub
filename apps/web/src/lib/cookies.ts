export const hasCookie = (name: string): boolean => {
  if (typeof document === 'undefined') return false;
  return document.cookie
    .split(';')
    .map((part) => part.trim())
    .some((part) => part.startsWith(`${name}=`));
};

/**
 * Sets a cookie with a Max-Age in days. The CALLER must pre-encode `value`
 * if it can contain `;`, `,`, `\n`, or other cookie-attribute delimiters
 * (use `encodeURIComponent` or a structured encoder like `serializeConsent`).
 * As a guard, this function rejects values containing the delimiters that
 * would allow attribute injection — failing closed is safer than silently
 * letting a future caller pass user-derived input.
 */
export const setDaysCookie = (name: string, value: string, days: number): void => {
  if (/[;\r\n]/.test(value)) {
    throw new Error(
      'setDaysCookie: value contains a cookie delimiter; pre-encode with encodeURIComponent',
    );
  }
  const maxAge = days * 24 * 60 * 60;
  const secure =
    typeof window !== 'undefined' && window.location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${name}=${value}; Max-Age=${maxAge}; Path=/; SameSite=Lax${secure}`;
};
