import { createContext, type ReactNode, useCallback, useContext, useEffect, useState } from "react";
import { Toaster } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { findTool, type ToolId } from "@/features/catalog/registry";

type Theme = "light" | "dark" | "system";
type Preferences = {
  favorites: ToolId[];
  recent: ToolId[];
  theme: Theme;
  toggleFavorite: (id: ToolId) => void;
  visit: (id: ToolId) => void;
  setTheme: (theme: Theme) => void;
};
const PreferencesContext = createContext<Preferences | null>(null);

function readPreference(key: string): unknown {
  try {
    return JSON.parse(localStorage.getItem(`utility:${key}`) ?? "null");
  } catch {
    return null;
  }
}
function readToolIds(key: string): ToolId[] {
  const value = readPreference(key);
  return Array.isArray(value)
    ? value.filter((id): id is ToolId => typeof id === "string" && Boolean(findTool(id)))
    : [];
}
function savePreference(key: string, value: unknown) {
  try {
    localStorage.setItem(`utility:${key}`, JSON.stringify(value));
  } catch {
    /* Preferences remain available for this visit. */
  }
}

export function Providers({ children }: { children: ReactNode }) {
  const [favorites, setFavorites] = useState<ToolId[]>(() => readToolIds("favorites"));
  const [recent, setRecent] = useState<ToolId[]>(() => readToolIds("recent").slice(0, 4));
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = readPreference("theme");
    return saved === "light" || saved === "dark" ? saved : "system";
  });
  useEffect(() => savePreference("favorites", favorites), [favorites]);
  useEffect(() => savePreference("recent", recent), [recent]);
  useEffect(() => {
    savePreference("theme", theme);
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const update = () => {
      const isDark = theme === "dark" || (theme === "system" && media.matches);
      document.documentElement.classList.toggle("dark", isDark);
      document.documentElement.style.colorScheme = isDark ? "dark" : "light";
    };
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, [theme]);
  const toggleFavorite = useCallback(
    (id: ToolId) =>
      setFavorites((current) =>
        current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
      ),
    [],
  );
  const visit = useCallback(
    (id: ToolId) =>
      setRecent((current) =>
        current[0] === id ? current : [id, ...current.filter((item) => item !== id)].slice(0, 4),
      ),
    [],
  );
  return (
    <PreferencesContext.Provider
      value={{ favorites, recent, theme, toggleFavorite, visit, setTheme }}
    >
      <TooltipProvider>
        {children}
        <Toaster richColors position="bottom-right" theme={theme} />
      </TooltipProvider>
    </PreferencesContext.Provider>
  );
}

export function usePreferences() {
  const context = useContext(PreferencesContext);
  if (!context) throw new Error("Preferences provider is missing.");
  return context;
}
