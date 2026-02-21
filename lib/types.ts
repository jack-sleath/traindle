export type FootfallBand = '<10k' | '10k-100k' | '100k-500k' | '500k-1m' | '1m-5m' | '5m-10m' | '10m+';
export type StationType = 'terminus' | 'through' | 'interchange';
export type Region =
  | 'Scotland'
  | 'Northern Ireland'
  | 'Wales'
  | 'North West'
  | 'North East'
  | 'Yorkshire'
  | 'East Midlands'
  | 'West Midlands'
  | 'East of England'
  | 'London'
  | 'South East'
  | 'South West';

export interface Station {
  name: string;
  crs: string;
  operators: string[];
  region: Region;
  platforms: number;
  footfallBand: FootfallBand;
  stationType: StationType;
}

type RegionDir = 'N' | 'NE' | 'E' | 'SE' | 'S' | 'SW' | 'W' | 'NW';

export interface GuessResult {
  operator: 'correct' | 'partial' | 'wrong';
  /** close-* = adjacent region (orange), far-* = non-adjacent (red), with compass direction to mystery */
  region: 'correct' | `close-${RegionDir}` | `far-${RegionDir}`;
  /** close-higher/lower = ≤2 platforms off (orange), far-higher/lower = >2 platforms off (red) */
  platforms: 'correct' | 'close-higher' | 'close-lower' | 'far-higher' | 'far-lower';
  /** close-higher/lower = one band off (orange), far-higher/lower = more than one band off (red) */
  footfallBand: 'correct' | 'close-higher' | 'close-lower' | 'far-higher' | 'far-lower';
  stationType: 'correct' | 'wrong';
}

export interface GuessEntry {
  station: Station;
  result: GuessResult;
}
