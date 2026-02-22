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

function midnightExpiry(): Date {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  tomorrow.setUTCHours(0, 0, 0, 0);
  return new Date(tomorrow.getTime() - 1000);
}

export function setEasyModeCookie(enabled: boolean): void {
  const expiry = midnightExpiry();
  document.cookie = `traindle_easymode=${enabled ? '1' : '0'}; expires=${expiry.toUTCString()}; path=/`;
}

export function clearEasyModeCookie(): void {
  document.cookie = 'traindle_easymode=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/';
}

export function getEasyModeCookie(): boolean {
  const name = 'traindle_easymode=';
  const decodedCookie = decodeURIComponent(document.cookie);
  for (let cookie of decodedCookie.split(';')) {
    cookie = cookie.trim();
    if (cookie.indexOf(name) === 0) {
      return cookie.substring(name.length) === '1';
    }
  }
  return false;
}
