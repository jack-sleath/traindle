import type { GuessEntry, GuessResult, Station } from '@/lib/types';

interface Props {
  entry: GuessEntry;
}

type TileResult = GuessResult[keyof GuessResult];

const CATEGORIES = ['operator', 'region', 'platforms', 'footfallBand', 'stationType'] as const;
type Category = (typeof CATEGORIES)[number];

const CATEGORY_LABELS: Record<Category, string> = {
  operator: 'Operator',
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

function Tile({ result, label, value }: { result: TileResult; label: string; value: string | string[] }) {
  let bg = '';
  let icon = '';

  if (result === 'correct') {
    bg = 'bg-green-500 dark:bg-green-600';
    icon = '✓';
  } else if (result === 'close' || result === 'partial') {
    bg = 'bg-orange-400 dark:bg-orange-500';
    icon = '~';
  } else if (result === 'wrong') {
    bg = 'bg-red-500 dark:bg-red-600';
    icon = '✗';
  } else if (result === 'higher') {
    bg = 'bg-amber-400 dark:bg-amber-500';
    icon = '↑';
  } else {
    // lower
    bg = 'bg-amber-400 dark:bg-amber-500';
    icon = '↓';
  }

  const displayValue = Array.isArray(value) ? value.join(', ') : value;

  return (
    <div
      className={`${bg} flex flex-col items-center justify-between rounded-lg flex-1 min-w-0 h-[60px] sm:h-[76px] px-1 sm:px-1.5 py-1 sm:py-1.5 text-white select-none`}
      title={`${label}: ${displayValue}`}
    >
      <span className="text-[7px] sm:text-[9px] uppercase tracking-widest font-semibold opacity-80 leading-none self-start truncate w-full">
        {label}
      </span>
      <span className="text-[9px] sm:text-[11px] font-bold text-center leading-tight w-full overflow-hidden">
        {Array.isArray(value)
          ? value.map((v) => <span key={v} className="block truncate">{v}</span>)
          : value}
      </span>
      <span className="text-sm sm:text-base font-bold leading-none self-end">
        {icon}
      </span>
    </div>
  );
}

export default function GuessRow({ entry }: Props) {
  const { station, result } = entry;

  return (
    <div className="flex items-center gap-1.5 sm:gap-2 w-full">
      <div className="w-14 sm:w-36 shrink-0 truncate text-xs sm:text-sm font-medium text-gray-800 dark:text-gray-200">
        {station.name}
      </div>
      <div className="flex gap-1.5 sm:gap-2 flex-1 min-w-0">
        {CATEGORIES.map((cat) => (
          <Tile
            key={cat}
            result={result[cat]}
            label={CATEGORY_LABELS[cat]}
            value={stationValue(cat, station)}
          />
        ))}
      </div>
    </div>
  );
}
