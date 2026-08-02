import { useEffect } from "react";
import { useLocation } from "react-router-dom";

// React Router no resetea el scroll al navegar (a diferencia de una
// navegación tradicional de browser) — si venís de haber scrolleado hasta el
// footer de la landing y hacés click en "Términos", la página nueva se monta
// con el scroll heredado, bien abajo. Esto lo lleva arriba en cada cambio de
// ruta.
const ScrollToTop = () => {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
};

export default ScrollToTop;
