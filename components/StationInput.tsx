'use client';

import { useState, useRef, useEffect } from 'react';
import type { Station } from '@/lib/types';

interface Props {
  stations: Station[];
  guessedCrs: Set<string>;
  onGuess: (station: Station) => void;
  disabled?: boolean;
}

export default function StationInput({ stations, guessedCrs, onGuess, disabled }: Props) {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<Station[]>([]);
  const [highlighted, setHighlighted] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    if (!query.trim()) {
      setSuggestions([]);
      setHighlighted(-1);
      return;
    }
    const lower = query.toLowerCase();
    const filtered = stations
      .filter((s) => !guessedCrs.has(s.crs) && (
        s.name.toLowerCase().includes(lower) ||
        s.crs.toLowerCase().includes(lower)
      ))
      .sort((a, b) => {
        const aC = a.crs.toLowerCase();
        const bC = b.crs.toLowerCase();
        const aExact = aC === lower ? 0 : aC.startsWith(lower) ? 1 : a.name.toLowerCase().includes(lower) ? 3 : 2;
        const bExact = bC === lower ? 0 : bC.startsWith(lower) ? 1 : b.name.toLowerCase().includes(lower) ? 3 : 2;
        return aExact - bExact;
      })
      .slice(0, 8);
    setSuggestions(filtered);
    setHighlighted(-1);
  }, [query, stations, guessedCrs]);

  function selectStation(station: Station) {
    onGuess(station);
    setQuery('');
    setSuggestions([]);
    setHighlighted(-1);
    inputRef.current?.focus();
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (suggestions.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlighted((h) => Math.min(h + 1, suggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlighted((h) => Math.max(h - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (highlighted >= 0) selectStation(suggestions[highlighted]);
      else if (suggestions.length === 1) selectStation(suggestions[0]);
    } else if (e.key === 'Escape') {
      setSuggestions([]);
      setHighlighted(-1);
    }
  }

  return (
    <div className="relative w-full max-w-md">
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        placeholder="Type a station name…"
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-base text-gray-900 shadow-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:placeholder:text-gray-500"
      />
      {suggestions.length > 0 && (
        <ul
          ref={listRef}
          className="absolute z-10 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-800"
        >
          {suggestions.map((s, i) => (
            <li
              key={s.crs}
              onMouseDown={() => selectStation(s)}
              className={`cursor-pointer px-4 py-2 text-sm text-gray-900 dark:text-gray-100 hover:bg-blue-50 dark:hover:bg-gray-700 ${
                i === highlighted ? 'bg-blue-100 dark:bg-gray-700' : ''
              }`}
            >
              {s.name}
              <span className="ml-2 text-xs text-gray-400">{s.crs}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
