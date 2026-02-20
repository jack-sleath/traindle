import seedrandom from 'seedrandom';
import type { Station } from './types';

// stations.json is loaded at build time; Next.js handles the JSON import
// eslint-disable-next-line @typescript-eslint/no-require-imports
const stations: Station[] = require('@/public/stations.json');

function todaySeed(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function getDailyStationIndex(seed?: string): number {
  const rng = seedrandom(seed ?? todaySeed());
  return Math.floor(rng() * stations.length);
}

export function getDailyStation(seed?: string): Station {
  return stations[getDailyStationIndex(seed)];
}

export { stations };
