import { REGION_ADJACENCY } from './regionAdjacency';
import type { Station, GuessResult, FootfallBand } from './types';

const FOOTFALL_ORDER: FootfallBand[] = ['<100k', '100k-1m', '1m-10m', '10m+'];

export function evaluateGuess(guess: Station, mystery: Station): GuessResult {
  const operator = guess.operator === mystery.operator ? 'correct' : 'wrong';

  let region: 'correct' | 'close' | 'wrong';
  if (guess.region === mystery.region) {
    region = 'correct';
  } else if (REGION_ADJACENCY[guess.region]?.includes(mystery.region)) {
    region = 'close';
  } else {
    region = 'wrong';
  }

  let platforms: 'correct' | 'higher' | 'lower';
  if (guess.platforms === mystery.platforms) {
    platforms = 'correct';
  } else if (mystery.platforms > guess.platforms) {
    platforms = 'higher';
  } else {
    platforms = 'lower';
  }

  const guessIdx = FOOTFALL_ORDER.indexOf(guess.footfallBand);
  const mystIdx = FOOTFALL_ORDER.indexOf(mystery.footfallBand);
  let footfallBand: 'correct' | 'higher' | 'lower';
  if (guessIdx === mystIdx) {
    footfallBand = 'correct';
  } else if (mystIdx > guessIdx) {
    footfallBand = 'higher';
  } else {
    footfallBand = 'lower';
  }

  const stationType = guess.stationType === mystery.stationType ? 'correct' : 'wrong';

  return { operator, region, platforms, footfallBand, stationType };
}
