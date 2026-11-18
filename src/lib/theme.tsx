import { createContext, type ReactNode, useContext, useEffect, useMemo, useState } from 'react';

export type Theme = 'pink' | 'light' | 'dark';

const KEY = 'catcards.theme';

function initialTheme(): Theme {
  const saved = localStorage.getItem(KEY);
  if (saved === 'pink' || saved === 'light' || saved === 'dark') return saved;
  return 'pink';
}

const Ctx = createContext<{ theme: Theme; setTheme: (t: Theme) => void } | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(initialTheme);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('theme-pink', theme === 'pink');
    root.classList.toggle('dark', theme === 'dark');
    const color = theme === 'dark' ? '#191118' : theme === 'pink' ? '#fff0f6' : '#fafafa';
    for (const meta of document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')) {
      meta.content = color;
    }
  }, [theme]);

  const value = useMemo(
    () => ({
      theme,
      setTheme: (next: Theme) => {
        localStorage.setItem(KEY, next);
        setThemeState(next);
      },
    }),
    [theme],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTheme() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useTheme outside provider');
  return v;
}
