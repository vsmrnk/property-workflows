// Тема (impl-template-versions-2 U5, AC-DSYS-05/06): вибір «Theme» — System / Light / Dark, зберігається в localStorage
// пристрою. На <html> стоїть data-theme = тема, що діє зараз ("light" чи "dark"); токени — src/app/globals.css.

export type ThemeChoice = "system" | "light" | "dark";

export const THEME_KEY = "theme";

export const THEME_OPTIONS: { value: ThemeChoice; label: string }[] = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

export const DARK_QUERY = "(prefers-color-scheme: dark)";

export function readThemeChoice(): ThemeChoice {
  try {
    const stored = localStorage.getItem(THEME_KEY);
    return stored === "light" || stored === "dark" ? stored : "system";
  } catch {
    return "system";
  }
}

export function applyTheme(choice: ThemeChoice = readThemeChoice()) {
  const dark = choice === "dark" || (choice === "system" && window.matchMedia(DARK_QUERY).matches);
  document.documentElement.dataset.theme = dark ? "dark" : "light";
}

// Вбудований у <head> скрипт (src/app/layout.tsx): ставить data-theme до першого малювання, щоб сторінка не блимала
// світлою темою, і стежить за системою, поки обрано «System». Та сама логіка, що readThemeChoice + applyTheme.
// Рядки — літерали, без підстановки значень у код (CodeQL js/bad-code-sanitization); збіг із DARK_QUERY і THEME_KEY
// перевіряє тест «THEME_SCRIPT бере ті самі ключ і медіазапит».
export const THEME_SCRIPT = `(function(){var q=window.matchMedia("(prefers-color-scheme: dark)");function a(){var t=null;try{t=localStorage.getItem("theme")}catch(e){}var d=t==="dark"||(t!=="light"&&q.matches);document.documentElement.dataset.theme=d?"dark":"light"}a();q.addEventListener("change",a)})();`;
