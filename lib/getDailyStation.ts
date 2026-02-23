import seedrandom from 'seedrandom';
import type { Station } from './types';

// stations.json is loaded at build time; Next.js handles the JSON import
// eslint-disable-next-line @typescript-eslint/no-require-imports
const stations: Station[] = require('@/public/stations.json');

function dateSeedDaysAgo(n: number): string {
  const now = new Date();
  now.setUTCDate(now.getUTCDate() - n);
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, '0');
  const d = String(now.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function todaySeed(): string {
  return dateSeedDaysAgo(0);
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

// Resolve the station that was actually shown on a given date, accounting for its
// own collision-avoidance against the provided previous station.
function resolveStationForDate(dateStr: string, prevStation: Station): Station {
  for (let attempt = 0; attempt < 10; attempt++) {
    const trySeed = attempt === 0 ? dateStr : `${dateStr}-${attempt}`;
    const idx = indexForSeed(trySeed);
    if (!categoriesMatch(stations[idx], prevStation)) {
      return stations[idx];
    }
  }
  return stations[indexForSeed(dateStr)];
}

export function getDailyStationIndex(seed?: string): number {
  // Custom seed (e.g. ?reveal= testing): skip duplicate check
  if (seed !== undefined) {
    return indexForSeed(seed);
  }

  const base = todaySeed();

  // Resolve the actual stations shown on the last two days, properly chained so
  // each accounts for its own collision-avoidance (yesterday may have used a
  // variant seed, so we can't just use its naive base seed).
  const threeDaysAgoStation = stations[indexForSeed(dateSeedDaysAgo(3))];
  const twoDaysAgoStation = resolveStationForDate(dateSeedDaysAgo(2), threeDaysAgoStation);
  const yesterdayStation = resolveStationForDate(dateSeedDaysAgo(1), twoDaysAgoStation);

  for (let attempt = 0; attempt < 10; attempt++) {
    const trySeed = attempt === 0 ? base : `${base}-${attempt}`;
    const idx = indexForSeed(trySeed);
    if (
      !categoriesMatch(stations[idx], yesterdayStation) &&
      !categoriesMatch(stations[idx], twoDaysAgoStation)
    ) {
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
