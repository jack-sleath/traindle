export type FootfallBand = '<100k' | '100k-1m' | '1m-10m' | '10m+';
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

export interface GuessResult {
  operator: 'correct' | 'partial' | 'wrong';
  region: 'correct' | 'close' | 'wrong';
  platforms: 'correct' | 'higher' | 'lower';
  footfallBand: 'correct' | 'higher' | 'lower';
  stationType: 'correct' | 'wrong';
}

export interface GuessEntry {
  station: Station;
  result: GuessResult;
}
