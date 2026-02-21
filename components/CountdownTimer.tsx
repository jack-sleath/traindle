'use client';

import { useState, useEffect } from 'react';

export default function CountdownTimer() {
  const [timeLeft, setTimeLeft] = useState('');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    function calculateTimeLeft() {
      const now = new Date();
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);

      const diff = tomorrow.getTime() - now.getTime();
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

  if (!mounted) {
    return (
      <div className="text-center mt-4">
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Next puzzle in</p>
        <p className="font-mono text-2xl font-bold text-gray-700 dark:text-gray-300">
          00:00:00
        </p>
      </div>
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
