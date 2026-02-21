/**
 * compile-stations.ts
 * One-off script to compile raw station data into public/stations.json
 * Run with: npx ts-node --project scripts/tsconfig.json scripts/compile-stations.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import type { Region, FootfallBand, StationType } from '../lib/types';

interface RawStation {
  stationName: string;
  lat: number;
  long: number;
  crsCode: string;
  constituentCountry: string;
}

interface UkStation {
  crs: string;
  name: string;
  operators: string[];
  owningOperator: string;
}

interface CompiledStation {
  name: string;
  crs: string;
  operators: string[];
  region: Region;
  platforms: number;
  footfallBand: FootfallBand;
  stationType: StationType;
}

// ── Region assignment ────────────────────────────────────────────────────────

function assignRegion(raw: RawStation): Region {
  const { lat, long: lon, constituentCountry } = raw;

  if (constituentCountry === 'scotland') return 'Scotland';
  if (constituentCountry === 'northern_ireland') return 'Northern Ireland';
  if (constituentCountry === 'wales') return 'Wales';

  // England sub-regions by bounding box (rough but practical)
  if (lat > 54.5) return 'North East';
  if (lat > 53.5 && lon < -2.0) return 'North West';
  if (lat > 53.5 && lon >= -2.0) return 'North East';
  if (lat > 53.2 && lon >= -2.0 && lon < 0.0) return 'Yorkshire';
  if (lat > 53.2 && lon < -2.0) return 'North West';
  if (lat >= 51.3 && lat <= 51.75 && lon >= -0.55 && lon <= 0.3) return 'London';
  if (lat > 52.3 && lon < -1.5) return 'West Midlands';
  if (lat > 52.3 && lon >= -1.5 && lon < 0.5) return 'East Midlands';
  if (lat > 51.8 && lon >= 0.5) return 'East of England';
  if (lat > 52.0 && lon < -2.5) return 'South West';
  if (lat <= 51.8 && lon < -1.0) return 'South West';
  if (lat <= 51.8 && lon >= -1.0 && lon < 0.5) return 'South East';
  if (lat <= 51.8 && lon >= 0.5) return 'South East';
  return 'East of England';
}

// ── Operator assignment ──────────────────────────────────────────────────────

const REGION_OPERATOR: Record<Region, string> = {
  Scotland: 'ScotRail',
  'Northern Ireland': 'Translink',
  Wales: 'Transport for Wales',
  'North West': 'Northern',
  'North East': 'Northern',
  Yorkshire: 'Northern',
  'East Midlands': 'East Midlands Railway',
  'West Midlands': 'West Midlands Trains',
  'East of England': 'Greater Anglia',
  London: 'London Overground',
  'South East': 'Southeastern',
  'South West': 'South Western Railway',
};

function assignOperators(crsCode: string, region: Region, ukStations: Record<string, UkStation>): string[] {
  const ukEntry = ukStations[crsCode];
  if (ukEntry?.operators?.length) return ukEntry.operators;
  return [REGION_OPERATOR[region]];
}

// ── Footfall band assignment ─────────────────────────────────────────────────

// Known high-footfall stations (approximate)
const HIGH_FOOTFALL: Set<string> = new Set([
  'WAT', 'VIC', 'LBG', 'FST', 'EUS', 'PAD', 'KGX', 'MAN', 'BHM', 'LDS',
  'EDB', 'GLC', 'NCL', 'LIV', 'SHF', 'BRI', 'RDG', 'CST', 'CTK', 'BFR',
]);

const MEDIUM_HIGH_FOOTFALL: Set<string> = new Set([
  'CBG', 'OXF', 'NRW', 'COV', 'NOT', 'YRK', 'SOT', 'CRE', 'BTN', 'SOU',
  'PMH', 'IPW', 'HUL', 'WVH', 'EXT', 'PLY', 'DVP', 'GLQ', 'ABD', 'GLC',
  'MYB', 'WIM', 'CLJ', 'SRA', 'ZFD', 'CHX',
]);

function assignFootfallBand(raw: RawStation): FootfallBand {
  if (HIGH_FOOTFALL.has(raw.crsCode)) return '10m+';
  if (MEDIUM_HIGH_FOOTFALL.has(raw.crsCode)) return '1m-10m';
  // Use name length + city-sounding names as rough proxy
  const name = raw.stationName.toLowerCase();
  const isMajorCity = /\b(central|piccadilly|lime street|new street|temple meads|queen street|waverley|victoria|paddington|waterloo|euston|cross|junction|international|airport|parkway)\b/.test(name);
  if (isMajorCity) return '1m-10m';
  // Small rural stations
  return '<100k';
}

// ── Platform count assignment ────────────────────────────────────────────────

const LARGE_STATION_PLATFORMS: Record<string, number> = {
  WAT: 19, VIC: 19, LBG: 15, FST: 18, EUS: 18, PAD: 14, KGX: 12,
  MAN: 14, BHM: 12, LDS: 17, CST: 6, CTK: 4, BFR: 6, MYB: 4,
  EDB: 19, GLC: 12, GLQ: 9, NCL: 12, LIV: 10, SHF: 8, BRI: 15,
  RDG: 10, CBG: 8, YRK: 11, NOT: 6, COV: 4, HUL: 8, NRW: 5,
  OXF: 4, WVH: 4, DVP: 6, SOU: 5, EXT: 5, PLY: 4, ABD: 6, IVN: 5,
  CRE: 8, BTN: 8, IPW: 4, PMH: 3, TAU: 3, CDF: 8, SWA: 5,
};

function assignPlatforms(raw: RawStation): number {
  if (LARGE_STATION_PLATFORMS[raw.crsCode]) {
    return LARGE_STATION_PLATFORMS[raw.crsCode];
  }
  const name = raw.stationName.toLowerCase();
  if (/\b(central|junction|parkway|international|airport|interchange)\b/.test(name)) return 4;
  if (/\b(street|road|square|gate|cross)\b/.test(name)) return 3;
  return 2;
}

// ── Station type assignment ──────────────────────────────────────────────────

const KNOWN_TERMINUS: Set<string> = new Set([
  'WAT', 'VIC', 'EUS', 'PAD', 'KGX', 'FST', 'CST', 'MYB', 'LBG',
  'PNZ', 'PLY', 'ABD', 'IVN', 'PMH', 'BFR', 'CTK',
]);

const KNOWN_INTERCHANGE: Set<string> = new Set([
  'BHM', 'MAN', 'LDS', 'NCL', 'SHF', 'EDB', 'GLC', 'GLQ', 'BRI',
  'RDG', 'CBG', 'YRK', 'NOT', 'COV', 'HUL', 'CRE', 'DVP', 'LIV',
  'BTN', 'SOU', 'NRW', 'OXF', 'WVH', 'CDF', 'EXT',
]);

function assignStationType(raw: RawStation, platforms: number): StationType {
  if (KNOWN_TERMINUS.has(raw.crsCode)) return 'terminus';
  if (KNOWN_INTERCHANGE.has(raw.crsCode)) return 'interchange';
  if (platforms >= 4) return 'interchange';
  return 'through';
}

// ── Main compilation ─────────────────────────────────────────────────────────

const rawPath = path.join(__dirname, 'raw-stations.json');
const ukStationsPath = path.join(__dirname, '..', 'uk_stations.json');
const outputPath = path.join(__dirname, '..', 'public', 'stations.json');

const raw: RawStation[] = JSON.parse(fs.readFileSync(rawPath, 'utf-8'));
const ukStations: Record<string, UkStation> = JSON.parse(fs.readFileSync(ukStationsPath, 'utf-8'));

const compiled: CompiledStation[] = raw.map((station) => {
  const region = assignRegion(station);
  const operators = assignOperators(station.crsCode, region, ukStations);
  const platforms = assignPlatforms(station);
  const footfallBand = assignFootfallBand(station);
  const stationType = assignStationType(station, platforms);

  return {
    name: station.stationName,
    crs: station.crsCode,
    operators,
    region,
    platforms,
    footfallBand,
    stationType,
  };
});

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, JSON.stringify(compiled, null, 2), 'utf-8');

console.log(`✓ Compiled ${compiled.length} stations → public/stations.json`);
const regionCounts = compiled.reduce<Record<string, number>>((acc, s) => {
  acc[s.region] = (acc[s.region] ?? 0) + 1;
  return acc;
}, {});
console.log('Stations per region:', regionCounts);
