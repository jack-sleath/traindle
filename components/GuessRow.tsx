'use client';

import { useState, useEffect, useRef } from 'react';
import type { GuessEntry, GuessResult, Station } from '@/lib/types';

interface Props {
  entry: GuessEntry;
}

type TileResult = GuessResult[keyof GuessResult];

const CATEGORIES = ['operator', 'region', 'platforms', 'footfallBand', 'stationType'] as const;
type Category = (typeof CATEGORIES)[number];

const CATEGORY_LABELS: Record<Category, string> = {
  operator: 'Operators',
  region: 'Region',
  platforms: 'Platforms',
  footfallBand: 'Footfall',
  stationType: 'Type',
};

function stationValue(cat: Category, station: Station): string | string[] {
  switch (cat) {
    case 'operator':     return station.operators;
    case 'region':       return station.region;
    case 'platforms':    return `${station.platforms} platform${station.platforms !== 1 ? 's' : ''}`;
    case 'footfallBand': return station.footfallBand;
    case 'stationType':  return station.stationType;
  }
}

const DIRECTION_ARROWS: Record<string, string> = {
  N: '↑', NE: '↗', E: '→', SE: '↘', S: '↓', SW: '↙', W: '←', NW: '↖',
  higher: '↑', lower: '↓',
};

const DIRECTION_LABELS: Record<string, string> = {
  N: 'north', NE: 'north-east', E: 'east', SE: 'south-east',
  S: 'south', SW: 'south-west', W: 'west', NW: 'north-west',
};

function explainResult(cat: Category, result: TileResult): string {
  if (result === 'correct') {
    const labels: Record<Category, string> = {
      operator: 'Operators match exactly',
      region: 'Same region',
      platforms: 'Same number of platforms',
      footfallBand: 'Same footfall band',
      stationType: 'Same station type',
    };
    return labels[cat];
  }
  if (result === 'partial') return 'Some operators match';
  if (result === 'wrong') {
    if (cat === 'operator') return 'No operators match';
    if (cat === 'stationType') return 'Different station type';
  }
  if (typeof result === 'string') {
    const isClose = result.startsWith('close-');
    const isFar = result.startsWith('far-');
    if (isClose || isFar) {
      const dir = result.slice(isClose ? 6 : 4);
      if (cat === 'region') {
        const dirLabel = DIRECTION_LABELS[dir] ?? dir;
        return isClose
          ? `Adjacent region — the station is to the ${dirLabel}`
          : `Non-adjacent region — the station is to the ${dirLabel}`;
      }
      if (cat === 'platforms') {
        const more = dir === 'higher';
        return isClose
          ? `The station has 1–2 ${more ? 'more' : 'fewer'} platforms`
          : `The station has 3+ ${more ? 'more' : 'fewer'} platforms`;
      }
      if (cat === 'footfallBand') {
        const higher = dir === 'higher';
        return isClose
          ? `The station is one footfall band ${higher ? 'higher' : 'lower'}`
          : `The station is 2+ footfall bands ${higher ? 'higher' : 'lower'}`;
      }
    }
  }
  return '';
}

function Tile({ cat, result, label, value, isOpen, onToggle }: {
  cat: Category;
  result: TileResult;
  label: string;
  value: string | string[];
  isOpen: boolean;
  onToggle: () => void;
}) {
  let bg = '';
  let icon = '';

  if (result === 'correct') {
    bg = 'bg-green-500 dark:bg-green-600';
    icon = '✓';
  } else if (result === 'partial') {
    bg = 'bg-orange-400 dark:bg-orange-500';
    icon = '~';
  } else if (typeof result === 'string' && result.startsWith('close-')) {
    bg = 'bg-orange-400 dark:bg-orange-500';
    icon = DIRECTION_ARROWS[result.slice(6)] ?? '~';
  } else if (typeof result === 'string' && result.startsWith('far-')) {
    bg = 'bg-red-500 dark:bg-red-600';
    icon = DIRECTION_ARROWS[result.slice(4)] ?? '✗';
  } else if (result === 'wrong') {
    bg = 'bg-red-500 dark:bg-red-600';
    icon = '✗';
  }

  const displayValue = Array.isArray(value) ? value.join(', ') : value;
  const explanation = explainResult(cat, result);

  return (
    <div className="relative flex-1 min-w-0">
      <div
        role="button"
        tabIndex={0}
        aria-expanded={isOpen}
        className={`${bg} flex flex-col items-center justify-between rounded-lg w-full h-[140px] sm:h-[180px] px-1 sm:px-1.5 py-1 sm:py-1.5 text-white select-none cursor-pointer`}
        onClick={onToggle}
        onKeyDown={(e) => e.key === 'Enter' && onToggle()}
        title={`${label}: ${displayValue}`}
      >
        <span className="text-[7px] sm:text-[9px] uppercase tracking-widest font-semibold opacity-80 leading-none self-start truncate w-full">
          {label}
        </span>
        <span className="text-[9px] sm:text-[11px] font-bold text-center w-full overflow-hidden break-words flex-1 flex flex-col items-center justify-center leading-relaxed">
          {Array.isArray(value)
            ? value.map((v) => <span key={v} className="block w-full">{v}</span>)
            : value}
        </span>
        <span className="text-sm sm:text-base font-bold leading-none self-end">
          {icon}
        </span>
      </div>

      {isOpen && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-20 w-36 sm:w-44 rounded-lg bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 shadow-xl p-2.5 text-center pointer-events-none">
          <p className="text-[10px] sm:text-xs font-semibold leading-tight">{displayValue}</p>
          {explanation && (
            <p className="text-[9px] sm:text-[11px] mt-1 opacity-80 leading-snug">{explanation}</p>
          )}
        </div>
      )}
    </div>
  );
}

export default function GuessRow({ entry }: Props) {
  const { station, result } = entry;
  const [activeCat, setActiveCat] = useState<Category | null>(null);
  const rowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!activeCat) return;
    function handleOutsideClick(e: MouseEvent) {
      if (rowRef.current && !rowRef.current.contains(e.target as Node)) {
        setActiveCat(null);
      }
    }
    document.addEventListener('click', handleOutsideClick);
    return () => document.removeEventListener('click', handleOutsideClick);
  }, [activeCat]);

  return (
    <div ref={rowRef} className="flex items-center gap-1.5 sm:gap-2 w-full">
      <div className="w-10 shrink-0 text-xs sm:text-sm font-medium text-gray-800 dark:text-gray-200" title={station.name}>
        {station.crs}
      </div>
      <div className="flex gap-1.5 sm:gap-2 flex-1 min-w-0">
        {CATEGORIES.map((cat) => (
          <Tile
            key={cat}
            cat={cat}
            result={result[cat]}
            label={CATEGORY_LABELS[cat]}
            value={stationValue(cat, station)}
            isOpen={activeCat === cat}
            onToggle={() => setActiveCat((prev) => (prev === cat ? null : cat))}
          />
        ))}
      </div>
    </div>
  );
}
