'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

export function useCaptureTimer() {
  const [remaining, setRemaining] = useState<number | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const onExpireRef = useRef<(() => void) | null>(null);

  const start = useCallback((seconds: number, onExpire?: () => void) => {
    stop();
    onExpireRef.current = onExpire ?? null;
    setRemaining(seconds);

    intervalRef.current = setInterval(() => {
      setRemaining((prev) => {
        if (prev === null || prev <= 1) {
          if (intervalRef.current) clearInterval(intervalRef.current);
          intervalRef.current = null;
          onExpireRef.current?.();
          return null;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  const stop = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setRemaining(null);
  }, []);

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  return { remaining, start, stop, isRunning: remaining !== null };
}
