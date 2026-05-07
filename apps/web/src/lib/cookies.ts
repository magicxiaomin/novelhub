export const hasCookie = (name: string): boolean => {
  if (typeof document === 'undefined') return false;
  return document.cookie
    .split(';')
    .map((part) => part.trim())
    .some((part) => part.startsWith(`${name}=`));
};

export const setDaysCookie = (name: string, value: string, days: number): void => {
  const maxAge = days * 24 * 60 * 60;
  const secure =
    typeof window !== 'undefined' && window.location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${name}=${value}; Max-Age=${maxAge}; Path=/; SameSite=Lax${secure}`;
};
