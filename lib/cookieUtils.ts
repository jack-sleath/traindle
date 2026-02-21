import type { GuessEntry } from './types';

export function setCookieGuesses(guesses: GuessEntry[]): void {
  // Calculate expiration: 1 second before next midnight
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);
  const expirationTime = new Date(tomorrow.getTime() - 1000); // 1 second before midnight

  const serialized = JSON.stringify(guesses);
  document.cookie = `traindle_guesses=${encodeURIComponent(serialized)}; expires=${expirationTime.toUTCString()}; path=/`;
}

export function getCookieGuesses(): GuessEntry[] {
  const name = 'traindle_guesses=';
  const decodedCookie = decodeURIComponent(document.cookie);
  const cookieArray = decodedCookie.split(';');

  for (let cookie of cookieArray) {
    cookie = cookie.trim();
    if (cookie.indexOf(name) === 0) {
      try {
        const serialized = cookie.substring(name.length);
        return JSON.parse(serialized);
      } catch {
        return [];
      }
    }
  }

  return [];
}

export function clearCookieGuesses(): void {
  document.cookie = 'traindle_guesses=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/';
}
