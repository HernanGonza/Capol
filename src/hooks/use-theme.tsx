import { createContext, useContext, useEffect, useState, ReactNode } from "react";

type Theme = "light" | "dark";

interface ThemeContextType {
  theme: Theme;
  toggleTheme: (originX?: number, originY?: number) => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: "light",
  toggleTheme: () => {},
});

export const useTheme = () => useContext(ThemeContext);

const STORAGE_KEY = "capol-theme";

const getInitialTheme = (): Theme => {
  if (typeof window === "undefined") return "light";
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === "light" || stored === "dark") return stored;
  // Si nunca lo eligió, respetamos la preferencia del sistema operativo.
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
};

const applyTheme = (theme: Theme) => {
  document.documentElement.classList.toggle("dark", theme === "dark");
};

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const [theme, setTheme] = useState<Theme>(getInitialTheme);

  // Aplicar el tema apenas se monta (antes de cualquier toggle manual),
  // por si el valor inicial vino de localStorage o del sistema operativo.
  useEffect(() => {
    applyTheme(theme);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleTheme = (originX?: number, originY?: number) => {
    const next: Theme = theme === "dark" ? "light" : "dark";

    const switchTheme = () => {
      setTheme(next);
      localStorage.setItem(STORAGE_KEY, next);
      applyTheme(next);
    };

    // Antes usábamos la View Transitions API (document.startViewTransition)
    // para el efecto de círculo. El problema: esa API saca una captura de
    // TODA la página (videos con autoplay de los flyers de curso, blurs,
    // sombras) antes de animar, y esa captura es lo que dejaba todo trabado
    // varios segundos después de que la animación se veía terminada — no
    // había forma de evitarlo sin dejar de usarla.
    //
    // Ahora el círculo es un <div> propio animado con clip-path (Web
    // Animations API), sin sacarle "foto" a nada. El tema real cambia ANTES
    // de que arranque la animación, así que la app queda usable al instante;
    // el círculo es puramente decorativo por encima, con pointer-events:none.
    const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const canAnimate = reduceMotion === false && typeof document.documentElement.animate === "function";

    if (!canAnimate) {
      switchTheme();
      return;
    }

    const x = originX ?? window.innerWidth / 2;
    const y = originY ?? window.innerHeight / 2;
    const oldBg = getComputedStyle(document.documentElement).getPropertyValue("--background").trim();

    const overlay = document.createElement("div");
    overlay.style.position = "fixed";
    overlay.style.inset = "0";
    overlay.style.zIndex = "9999";
    overlay.style.pointerEvents = "none";
    overlay.style.background = `hsl(${oldBg})`;
    document.body.appendChild(overlay);

    switchTheme();

    const maxRadius = Math.hypot(
      Math.max(x, window.innerWidth - x),
      Math.max(y, window.innerHeight - y),
    );

    const anim = overlay.animate(
      [
        { clipPath: `circle(${maxRadius}px at ${x}px ${y}px)` },
        { clipPath: `circle(0px at ${x}px ${y}px)` },
      ],
      { duration: 500, easing: "ease-out" },
    );
    const cleanup = () => overlay.remove();
    anim.addEventListener("finish", cleanup);
    anim.addEventListener("cancel", cleanup);
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};