'use client';

import { useState, useEffect } from 'react';

interface Props {
  compact?: boolean;
}

export default function CountdownTimer({ compact = false }: Props) {
  const [timeLeft, setTimeLeft] = useState('00:00:00');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    function calculateTimeLeft() {
      const now = new Date();
      // Count down to next UTC midnight (when the puzzle resets)
      const nextUtcMidnight = new Date(Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate() + 1,
      ));

      const diff = nextUtcMidnight.getTime() - now.getTime();
      const hours = String(Math.floor((diff / (1000 * 60 * 60)) % 24)).padStart(2, '0');
      const minutes = String(Math.floor((diff / (1000 * 60)) % 60)).padStart(2, '0');
      const seconds = String(Math.floor((diff / 1000) % 60)).padStart(2, '0');

      setTimeLeft(`${hours}:${minutes}:${seconds}`);
    }

    calculateTimeLeft();
    setMounted(true);
    const interval = setInterval(calculateTimeLeft, 1000);
    return () => clearInterval(interval);
  }, []);

  if (compact) {
    return (
      <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
        Next puzzle in{' '}
        <span className={`font-mono font-semibold ${mounted ? '' : 'opacity-0'}`}>
          {timeLeft}
        </span>
      </p>
    );
  }

  return (
    <div className="text-center mt-4">
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Next puzzle in</p>
      <p className="font-mono text-2xl font-bold text-gray-700 dark:text-gray-300">
        {timeLeft}
      </p>
    </div>
  );
}
