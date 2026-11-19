/** Clean Lab is a light design; dark is an opt-in per device (design_system.md §2). */
export type ThemeChoice = 'light' | 'dark' | 'system';
const KEY = 'spoh.theme';

/** Reads the saved choice (per-device convenience; safe if storage is blocked). */
export function loadTheme(): ThemeChoice {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'dark' || v === 'system' ? v : 'light';
  } catch {
    return 'light';
  }
}

export function resolveTheme(choice: ThemeChoice): 'light' | 'dark' {
  if (choice !== 'system') return choice;
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function applyTheme(choice: ThemeChoice) {
  document.documentElement.dataset.theme = resolveTheme(choice);
  try {
    if (choice === 'light') localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, choice);
  } catch {
    /* ignore */
  }
}
