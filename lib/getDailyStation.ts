import seedrandom from 'seedrandom';
import type { Station } from './types';

// stations.json is loaded at build time; Next.js handles the JSON import
// eslint-disable-next-line @typescript-eslint/no-require-imports
const stations: Station[] = require('@/public/stations.json');

function todaySeed(): string {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, '0');
  const d = String(now.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function yesterdaySeed(): string {
  const now = new Date();
  now.setUTCDate(now.getUTCDate() - 1);
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, '0');
  const d = String(now.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function indexForSeed(seed: string): number {
  const rng = seedrandom(seed);
  return Math.floor(rng() * stations.length);
}

function categoriesMatch(a: Station, b: Station): boolean {
  return (
    a.region === b.region &&
    a.platforms === b.platforms &&
    a.footfallBand === b.footfallBand &&
    a.stationType === b.stationType &&
    a.operators.length === b.operators.length &&
    [...a.operators].sort().every((op, i) => op === [...b.operators].sort()[i])
  );
}

export function getDailyStationIndex(seed?: string): number {
  // Custom seed (e.g. ?reveal= testing): skip duplicate check
  if (seed !== undefined) {
    return indexForSeed(seed);
  }

  const base = todaySeed();
  const yesterday = stations[indexForSeed(yesterdaySeed())];

  for (let attempt = 0; attempt < 10; attempt++) {
    const trySeed = attempt === 0 ? base : `${base}-${attempt}`;
    const idx = indexForSeed(trySeed);
    if (!categoriesMatch(stations[idx], yesterday)) {
      return idx;
    }
  }

  // Fallback: return base seed result if all 10 attempts collide (extremely unlikely)
  return indexForSeed(base);
}

export function getDailyStation(seed?: string): Station {
  return stations[getDailyStationIndex(seed)];
}

export { stations };
