import { useEffect } from "react";

const SITE_URL = "https://www.capolescuela.com";

// Al ser una SPA con un solo index.html, todas las rutas comparten el mismo
// <title> y no hay <link rel="canonical"> por página — Google ve el mismo
// título en la landing, en /terminos, en /auth, etc. Este hook lo corrige
// del lado del cliente: sin agregar react-helmet, alcanza con esto porque
// los bots que sí ejecutan JS (Google) ya lo van a ver actualizado antes de
// indexar.
export function useDocumentMeta(title: string, path: string) {
  useEffect(() => {
    const previousTitle = document.title;
    document.title = title;

    let link = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    const isNew = !link;
    if (!link) {
      link = document.createElement("link");
      link.rel = "canonical";
      document.head.appendChild(link);
    }
    const previousHref = link.href;
    link.href = `${SITE_URL}${path}`;

    return () => {
      document.title = previousTitle;
      if (link) {
        if (isNew) link.remove();
        else link.href = previousHref;
      }
    };
  }, [title, path]);
}
