import seedrandom from 'seedrandom';
import type { Station } from './types';

// stations.json is loaded at build time; Next.js handles the JSON import
// eslint-disable-next-line @typescript-eslint/no-require-imports
const stations: Station[] = require('@/public/stations.json');

function dateStr(daysAgo: number): string {
  const now = new Date();
  now.setUTCDate(now.getUTCDate() - daysAgo);
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

// Returns the station index for `base`, skipping any candidate that matches `anchor`.
function resolveIndex(base: string, anchor: Station): number {
  for (let attempt = 0; attempt < 10; attempt++) {
    const trySeed = attempt === 0 ? base : `${base}-${attempt}`;
    const idx = indexForSeed(trySeed);
    if (!categoriesMatch(stations[idx], anchor)) {
      return idx;
    }
  }
  // Fallback: return base seed result if all 10 attempts collide (extremely unlikely)
  return indexForSeed(base);
}

export function getDailyStationIndex(seed?: string): number {
  // Custom seed (e.g. ?reveal= testing): skip duplicate check
  if (seed !== undefined) {
    return indexForSeed(seed);
  }

  // Use the day-before-yesterday's base seed as a fixed anchor, then resolve
  // yesterday's *actual* station (which may itself have been a fallback).
  // This ensures today's check is against what was genuinely shown yesterday.
  const dayBeforeYesterday = stations[indexForSeed(dateStr(2))];
  const yesterdayActual = stations[resolveIndex(dateStr(1), dayBeforeYesterday)];

  return resolveIndex(dateStr(0), yesterdayActual);
}

export function getDailyStation(seed?: string): Station {
  return stations[getDailyStationIndex(seed)];
}

export { stations };
