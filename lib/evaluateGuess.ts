import { REGION_ADJACENCY } from './regionAdjacency';
import type { Station, GuessResult, FootfallBand, Region } from './types';

const FOOTFALL_ORDER: FootfallBand[] = ['<10k', '10k-100k', '100k-500k', '500k-1m', '1m-5m', '5m-10m', '10m+'];

// Approximate geographic centroids [lat, lon] for each region
const REGION_CENTROIDS: Record<Region, [number, number]> = {
  'Scotland':          [56.5, -4.2],
  'Northern Ireland':  [54.6, -6.7],
  'Wales':             [52.3, -3.7],
  'North West':        [53.9, -2.6],
  'North East':        [54.9, -1.7],
  'Yorkshire':         [53.9, -1.5],
  'East Midlands':     [52.8, -1.0],
  'West Midlands':     [52.5, -1.9],
  'East of England':   [52.2,  0.5],
  'London':            [51.5, -0.1],
  'South East':        [51.2,  0.5],
  'South West':        [51.0, -3.0],
};

function directionBetween(from: Region, to: Region): GuessResult['region'] {
  const [fromLat, fromLon] = REGION_CENTROIDS[from];
  const [toLat,   toLon  ] = REGION_CENTROIDS[to];
  const dlat = toLat - fromLat; // positive = north
  const dlon = toLon - fromLon; // positive = east
  // atan2(dlon, dlat) gives bearing from north, clockwise positive
  const deg = Math.atan2(dlon, dlat) * (180 / Math.PI);
  let dir: 'N' | 'NE' | 'E' | 'SE' | 'S' | 'SW' | 'W' | 'NW';
  if      (deg >= -22.5  && deg <  22.5)  dir = 'N';
  else if (deg >=  22.5  && deg <  67.5)  dir = 'NE';
  else if (deg >=  67.5  && deg < 112.5)  dir = 'E';
  else if (deg >= 112.5  && deg < 157.5)  dir = 'SE';
  else if (deg >=  157.5 || deg < -157.5) dir = 'S';
  else if (deg >= -157.5 && deg < -112.5) dir = 'SW';
  else if (deg >= -112.5 && deg <  -67.5) dir = 'W';
  else                                    dir = 'NW';
  const proximity = REGION_ADJACENCY[from]?.includes(to) ? 'close' : 'far';
  return `${proximity}-${dir}`;
}

export function evaluateGuess(guess: Station, mystery: Station): GuessResult {
  const guessSet = new Set(guess.operators);
  const mysterySet = new Set(mystery.operators);
  const matches = mystery.operators.filter((o) => guessSet.has(o)).length;
  const operator =
    matches === 0 ? 'wrong'
    : matches === mysterySet.size && guessSet.size === mysterySet.size ? 'correct'
    : 'partial';

  const region: GuessResult['region'] = guess.region === mystery.region
    ? 'correct'
    : directionBetween(guess.region, mystery.region);

  const platDiff = mystery.platforms - guess.platforms;
  let platforms: GuessResult['platforms'];
  if (platDiff === 0)                          platforms = 'correct';
  else if (platDiff >= 1 && platDiff <= 2)     platforms = 'close-higher';
  else if (platDiff <= -1 && platDiff >= -2)   platforms = 'close-lower';
  else if (platDiff > 2)                       platforms = 'far-higher';
  else                                         platforms = 'far-lower';

  const guessIdx = FOOTFALL_ORDER.indexOf(guess.footfallBand);
  const mystIdx = FOOTFALL_ORDER.indexOf(mystery.footfallBand);
  const diff = mystIdx - guessIdx;
  let footfallBand: GuessResult['footfallBand'];
  if (diff === 0)       footfallBand = 'correct';
  else if (diff === 1)  footfallBand = 'close-higher';
  else if (diff === -1) footfallBand = 'close-lower';
  else if (diff > 1)    footfallBand = 'far-higher';
  else                  footfallBand = 'far-lower';

  const stationType = guess.stationType === mystery.stationType ? 'correct' : 'wrong';

  return { operator, region, platforms, footfallBand, stationType };
}
