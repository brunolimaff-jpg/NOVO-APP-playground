import { useState, useEffect } from 'react';

const THEME_KEY = 'scout360_theme';

export function useTheme() {
  const [isDarkMode, setIsDarkMode] = useState(() => localStorage.getItem(THEME_KEY) === 'dark');

  useEffect(() => {
    document.body.className = isDarkMode ? 'dark' : 'light';
    document.body.style.backgroundColor = isDarkMode ? '#020617' : '#f8fafc';
    document.body.style.color = isDarkMode ? '#e2e8f0' : '#0f172a';
    localStorage.setItem(THEME_KEY, isDarkMode ? 'dark' : 'light');
  }, [isDarkMode]);

  const toggleTheme = () => setIsDarkMode(prev => !prev);

  return { isDarkMode, setIsDarkMode, toggleTheme };
}
