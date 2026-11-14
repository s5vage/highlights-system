'use client';

import { useEffect, useState } from 'react';
import { usePrefs } from '@/lib/prefs';

// The sun/moon button in the tab bar. It flips between light and dark (and stops following "System",
// because you just made a choice). The full choice lives in Settings → Appearance.
export function useTheme() {
  const { setPrefs } = usePrefs();
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  useEffect(() => {
    const read = () => setTheme(document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark');
    read();
    window.addEventListener('hl-theme-change', read); // Settings or the computer changed it
    return () => window.removeEventListener('hl-theme-change', read);
  }, []);

  function toggleTheme() {
    setPrefs({ theme: theme === 'light' ? 'dark' : 'light' });
  }

  return { theme, toggleTheme };
}