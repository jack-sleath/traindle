'use client';

import { useState, useMemo, useEffect } from 'react';
import StationInput from '@/components/StationInput';
import GuessRow from '@/components/GuessRow';
import ThemeToggle from '@/components/ThemeToggle';
import CountdownTimer from '@/components/CountdownTimer';
import { getDailyStation, stations } from '@/lib/getDailyStation';
import { evaluateGuess } from '@/lib/evaluateGuess';
import { setCookieGuesses, getCookieGuesses } from '@/lib/cookieUtils';
import type { Station, GuessEntry } from '@/lib/types';

const EMOJI: Record<string, string> = {
  correct: '🟩',
  partial: '🟧',
  wrong:   '🟥',
  higher:  '⬆️',
  lower:   '⬇️',
};
function resultEmoji(r: string): string {
  if (r === 'correct') return '🟩';
  if (r.startsWith('close-')) return '🟧';
  if (r.startsWith('far-'))   return '🟥';
  return EMOJI[r] ?? '⬜';
}

export default function Home() {
  const mystery: Station = useMemo(() => getDailyStation(), []);
  const [guesses, setGuesses] = useState<GuessEntry[]>([]);
  const [mounted, setMounted] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [copied, setCopied] = useState(false);

  // Load guesses from cookie on mount
  useEffect(() => {
    const savedGuesses = getCookieGuesses();
    setGuesses(savedGuesses);
    setMounted(true);
  }, []);

  // Save guesses to cookie whenever they change
  useEffect(() => {
    if (mounted) {
      setCookieGuesses(guesses);
    }
  }, [guesses, mounted]);

  const won = guesses.some((g) =>
    Object.values(g.result).every((v) => v === 'correct'),
  );
  const gameOver = won;

  function handleGuess(station: Station) {
    if (gameOver) return;
    const result = evaluateGuess(station, mystery);
    const entry: GuessEntry = { station, result };
    const next = [...guesses, entry];
    setGuesses(next);

    const justWon = Object.values(result).every((v) => v === 'correct');
    if (justWon) setShowModal(true);
  }

  function buildShareText(): string {
    const today = new Date();
    const dateStr = `${today.getUTCFullYear()}-${String(today.getUTCMonth() + 1).padStart(2, '0')}-${String(today.getUTCDate()).padStart(2, '0')}`;
    const score = `${guesses.length}`;
    const categories = ['operator', 'region', 'platforms', 'footfallBand', 'stationType'] as const;
    const grid = guesses
      .map((g) => categories.map((c) => resultEmoji(g.result[c])).join(''))
      .join('\n');
    return `Traindle ${dateStr} — ${score}\n${grid}`;
  }

  async function handleShare() {
    const text = buildShareText();
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const guessedCrs = useMemo(
    () => new Set(guesses.map((g) => g.station.crs)),
    [guesses],
  );

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col items-center py-10 px-4 transition-colors">

      {/* Header */}
      <div className="w-full max-w-3xl flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-gray-50">
            Traindle
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            Guess today&apos;s UK railway station
          </p>
          <CountdownTimer compact />
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-gray-600 dark:text-gray-300">
            {guesses.length} guess{guesses.length !== 1 ? 'es' : ''}
          </span>
          <ThemeToggle />
        </div>
      </div>

      {/* Input */}
      {!gameOver && (
        <div className="mb-8 w-full max-w-3xl">
          <StationInput
            stations={stations}
            guessedCrs={guessedCrs}
            onGuess={handleGuess}
          />
        </div>
      )}

      {/* Guess board */}
      {guesses.length > 0 && (
        <div className="w-full max-w-3xl flex flex-col gap-3">
          {[...guesses].reverse().map((entry, i) => (
            <GuessRow key={i} entry={entry} />
          ))}
        </div>
      )}

      {/* Game-over inline message */}
      {gameOver && !showModal && (
        <div className="mt-8 text-center">
          <p className="text-green-600 dark:text-green-400 font-semibold text-lg">You got it!</p>
          <button
            onClick={() => setShowModal(true)}
            className="mt-3 rounded-full bg-gray-800 dark:bg-gray-200 px-5 py-2 text-sm text-white dark:text-gray-900 hover:bg-gray-700 dark:hover:bg-gray-300 transition-colors"
          >
            Results
          </button>
        </div>
      )}

      {/* Results modal */}
      {showModal && (
        <div
          className="fixed inset-0 z-20 flex items-center justify-center bg-black/50"
          onClick={() => setShowModal(false)}
        >
          <div
            className="relative w-full max-w-sm rounded-2xl bg-white dark:bg-gray-800 p-8 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setShowModal(false)}
              className="absolute right-4 top-4 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 text-xl"
            >
              ✕
            </button>

            <h2 className="text-2xl font-bold text-green-600 dark:text-green-400 text-center">
              You got it! 🎉
            </h2>
            <p className="text-center text-gray-600 dark:text-gray-400 mt-1">
              in {guesses.length} guess{guesses.length !== 1 ? 'es' : ''}
            </p>

            <pre className="mt-4 rounded-lg bg-gray-100 dark:bg-gray-700 p-3 text-sm text-center font-mono whitespace-pre-wrap text-gray-800 dark:text-gray-200">
              {buildShareText()}
            </pre>

            <button
              onClick={handleShare}
              className="mt-4 w-full rounded-full bg-gray-900 dark:bg-gray-100 py-3 text-sm font-semibold text-white dark:text-gray-900 hover:bg-gray-700 dark:hover:bg-gray-300 transition-colors"
            >
              {copied ? 'Copied! ✓' : 'Share result'}
            </button>

            <CountdownTimer />
          </div>
        </div>
      )}
    </main>
  );
}
