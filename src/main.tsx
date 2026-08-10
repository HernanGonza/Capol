import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import ErrorBoundary from "./components/ErrorBoundary.tsx";
import "./index.css";

// Cada ruta se carga con lazy() en un archivo aparte (chunk) con un hash en
// el nombre. Cuando se hace un deploy nuevo, esos hashes cambian y los
// archivos viejos dejan de existir en el servidor — si alguien ya tenía la
// app abierta desde antes y navega a una ruta que todavía no cargó, falla
// con "Failed to fetch dynamically imported module". Vite dispara este
// evento en ese caso puntual: recargamos una sola vez (el flag evita loop
// si el fallo es por otra razón, ej. sin conexión) para traer el bundle
// nuevo en vez de mostrar el error.
window.addEventListener("vite:preloadError", () => {
  if (!sessionStorage.getItem("reloaded-after-preload-error")) {
    sessionStorage.setItem("reloaded-after-preload-error", "1");
    window.location.reload();
  }
});

createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>,
);
