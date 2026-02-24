'use client';

import { useState, useMemo, useEffect } from 'react';
import StationInput from '@/components/StationInput';
import GuessRow from '@/components/GuessRow';
import ThemeToggle from '@/components/ThemeToggle';
import CountdownTimer from '@/components/CountdownTimer';
import KeyModal from '@/components/KeyModal';
import { getDailyStation, stations } from '@/lib/getDailyStation';
import { evaluateGuess } from '@/lib/evaluateGuess';
import { setCookieGuesses, getCookieGuesses, clearCookieGuesses, setEasyModeCookie, getEasyModeCookie, clearEasyModeCookie } from '@/lib/cookieUtils';
import type { Station, GuessEntry } from '@/lib/types';

const EMOJI: Record<string, string> = {
  correct: '🟩',
  partial: '🟧',
  wrong:   '🟥',
  higher:  '🟥',
  lower:   '🟥',
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
  const [easyMode, setEasyMode] = useState(false);
  const [easyModeConfirm, setEasyModeConfirm] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [showAlsoCorrect, setShowAlsoCorrect] = useState(false);
  const [copied, setCopied] = useState(false);
  const [revealAnswer, setRevealAnswer] = useState(false);

  // Load guesses and easy mode from cookies on mount; ?reset clears them first
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.has('reset')) {
      clearCookieGuesses();
      clearEasyModeCookie();
      window.history.replaceState({}, '', window.location.pathname);
    } else {
      setGuesses(getCookieGuesses());
    }
    if (params.has('reveal')) setRevealAnswer(true);
    setEasyMode(getEasyModeCookie());
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
    const easyTag = easyMode ? ' [easy mode]' : '';
    return `Traindle ${dateStr} — ${score}${easyTag}\n${grid}\nhttps://jack-sleath.github.io/traindle/`;
  }

  async function handleShare() {
    const text = buildShareText();
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    if (navigator.share) {
      try {
        await navigator.share({ text });
      } catch {
        // user cancelled — clipboard copy already done
      }
    }
  }

  const guessedCrs = useMemo(
    () => new Set(guesses.map((g) => g.station.crs)),
    [guesses],
  );

  function handleEasyModeClick() {
    if (!easyModeConfirm) {
      setEasyModeConfirm(true);
    } else {
      setEasyMode(true);
      setEasyModeConfirm(false);
      setEasyModeCookie(true);
    }
  }

  // When easy mode is on, filter the station list to only show stations that
  // match every attribute for which a previous guess returned 'correct'.
  const easyModeStations = useMemo(() => {
    if (!easyMode) return stations;
    let filtered = stations;
    const correctOp = guesses.find((g) => g.result.operator === 'correct');
    const correctRegion = guesses.find((g) => g.result.region === 'correct');
    const correctPlatforms = guesses.find((g) => g.result.platforms === 'correct');
    const correctFootfall = guesses.find((g) => g.result.footfallBand === 'correct');
    const correctType = guesses.find((g) => g.result.stationType === 'correct');
    if (correctOp) {
      const ops = [...correctOp.station.operators].sort().join('|');
      filtered = filtered.filter((s) => [...s.operators].sort().join('|') === ops);
    }
    if (correctRegion) {
      filtered = filtered.filter((s) => s.region === correctRegion.station.region);
    }
    if (correctPlatforms) {
      filtered = filtered.filter((s) => s.platforms === correctPlatforms.station.platforms);
    }
    if (correctFootfall) {
      filtered = filtered.filter((s) => s.footfallBand === correctFootfall.station.footfallBand);
    }
    if (correctType) {
      filtered = filtered.filter((s) => s.stationType === correctType.station.stationType);
    }
    return filtered;
  }, [easyMode, guesses]);

  // Stations that share every attribute with the mystery (excluding the mystery itself)
  const alsoCorrect = useMemo(() => {
    const mOps = [...mystery.operators].sort().join('|');
    return stations.filter((s) =>
      s.crs !== mystery.crs &&
      [...s.operators].sort().join('|') === mOps &&
      s.region === mystery.region &&
      s.platforms === mystery.platforms &&
      s.footfallBand === mystery.footfallBand &&
      s.stationType === mystery.stationType,
    );
  }, [mystery]);

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
          <button
            onClick={handleEasyModeClick}
            onBlur={() => setEasyModeConfirm(false)}
            disabled={easyMode || gameOver}
            title={easyMode ? 'Easy mode is on — correct answers filter the station list' : 'Enable easy mode: correct answers will filter the station list (cannot be undone today)'}
            className={`rounded-full px-3 h-8 text-xs font-semibold transition-colors ${
              easyMode
                ? 'bg-green-100 text-green-700 border border-green-300 dark:bg-green-900/40 dark:text-green-300 dark:border-green-700 cursor-default'
                : easyModeConfirm
                  ? 'bg-amber-100 text-amber-700 border border-amber-300 dark:bg-amber-900/40 dark:text-amber-300 dark:border-amber-700'
                  : 'border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
          >
            {easyMode ? 'Easy ✓' : easyModeConfirm ? 'Sure?' : 'Easy'}
          </button>
          <button
            onClick={() => setShowKey(true)}
            className="rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            aria-label="How to play"
          >
            ?
          </button>
          <ThemeToggle />
        </div>
      </div>

      {/* Dev reveal banner */}
      {revealAnswer && (
        <div className="mb-4 w-full max-w-3xl rounded-lg border border-yellow-300 bg-yellow-50 dark:border-yellow-700 dark:bg-yellow-900/20 px-4 py-2 text-sm text-yellow-800 dark:text-yellow-300">
          <span className="font-semibold">Today&apos;s answer:</span> {mystery.name}{' '}
          <span className="text-xs text-yellow-600 dark:text-yellow-400">{mystery.crs}</span>
        </div>
      )}

      {/* Input / game-over message */}
      <div className="mb-8 w-full max-w-3xl">
        {gameOver ? (
          <div className="text-center">
            <p className="text-green-600 dark:text-green-400 font-semibold text-lg">You got it!</p>
            <button
              onClick={() => setShowModal(true)}
              className="mt-3 rounded-full bg-gray-800 dark:bg-gray-200 px-5 py-2 text-sm text-white dark:text-gray-900 hover:bg-gray-700 dark:hover:bg-gray-300 transition-colors"
            >
              Results
            </button>
          </div>
        ) : (
          <StationInput
            stations={easyModeStations}
            guessedCrs={guessedCrs}
            onGuess={handleGuess}
          />
        )}
      </div>

      {/* Guess board */}
      {guesses.length > 0 && (
        <div className="w-full max-w-3xl flex flex-col gap-3">
          {[...guesses].reverse().map((entry, i) => (
            <GuessRow key={i} entry={entry} />
          ))}
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
            {easyMode && (
              <p className="text-center text-amber-600 dark:text-amber-400 text-xs mt-1 font-medium">
                Easy mode used
              </p>
            )}

            <pre className="mt-4 rounded-lg bg-gray-100 dark:bg-gray-700 p-3 text-sm text-center font-mono whitespace-pre-wrap text-gray-800 dark:text-gray-200 max-h-48 overflow-y-auto">
              {buildShareText()}
            </pre>

            <button
              onClick={handleShare}
              className="mt-4 w-full rounded-full bg-gray-900 dark:bg-gray-100 py-3 text-sm font-semibold text-white dark:text-gray-900 hover:bg-gray-700 dark:hover:bg-gray-300 transition-colors"
            >
              {copied ? 'Copied! ✓' : 'Share result'}
            </button>

            {alsoCorrect.length > 0 && (
              <div className="mt-4">
                <button
                  onClick={() => setShowAlsoCorrect((v) => !v)}
                  className="w-full flex items-center justify-between rounded-lg bg-gray-100 dark:bg-gray-700 px-4 py-2.5 text-sm font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                >
                  <span>{alsoCorrect.length} other correct answer{alsoCorrect.length !== 1 ? 's' : ''}</span>
                  <span>{showAlsoCorrect ? '▲' : '▼'}</span>
                </button>
                {showAlsoCorrect && (
                  <ul className="mt-1 max-h-40 overflow-y-auto rounded-lg border border-gray-200 dark:border-gray-600 text-sm text-gray-800 dark:text-gray-200 divide-y divide-gray-100 dark:divide-gray-700">
                    {alsoCorrect.map((s) => (
                      <li key={s.crs} className="flex items-center justify-between px-4 py-2">
                        <span>{s.name}</span>
                        <span className="text-xs text-gray-400 ml-2">{s.crs}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            <CountdownTimer />
          </div>
        </div>
      )}

      {/* Key modal */}
      {showKey && <KeyModal onClose={() => setShowKey(false)} />}
    </main>
  );
}
