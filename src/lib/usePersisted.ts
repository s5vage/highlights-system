'use client';

import { useCallback, useEffect, useState } from 'react';

// An on/off setting that is remembered between visits. Call it with no argument to flip it.
export function usePersistedBool(key: string, initial = false): [boolean, (next?: boolean) => void] {
  const [value, setValue] = useState(initial);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw !== null) setValue(raw === '1');
    } catch {
      /* private mode: it just won't be remembered */
    }
  }, [key]);

  const set = useCallback(
    (next?: boolean) => {
      setValue((prev) => {
        const v = typeof next === 'boolean' ? next : !prev;
        try {
          localStorage.setItem(key, v ? '1' : '0');
        } catch {
          /* ignore */
        }
        return v;
      });
    },
    [key]
  );

  return [value, set];
}