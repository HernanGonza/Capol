import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Cookie } from "lucide-react";

const STORAGE_KEY = "cookie-consent";

// Banner simple: la Plataforma solo usa cookies/localStorage funcionales
// (sesión y tema claro/oscuro, ver Política de Privacidad), no hay nada de
// terceros que aceptar/rechazar por separado — así que es un único botón de
// "Aceptar" que solo deja de mostrarse una vez confirmado.
const CookieConsent = () => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (localStorage.getItem(STORAGE_KEY) !== "accepted") {
      setVisible(true);
    }
  }, []);

  const aceptar = () => {
    localStorage.setItem(STORAGE_KEY, "accepted");
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-0 inset-x-0 z-[100] p-4 sm:p-6">
      <div className="max-w-3xl mx-auto bg-white dark:bg-[#12121a] border border-slate-200 dark:border-white/10 rounded-2xl shadow-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-center gap-4">
        <div className="w-9 h-9 rounded-full bg-indigo-100 dark:bg-indigo-950/40 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
          <Cookie className="w-5 h-5" />
        </div>
        <p className="text-sm text-slate-600 dark:text-white/60 text-center sm:text-left flex-1">
          Usamos cookies propias solo para mantener tu sesión iniciada y recordar tu preferencia de tema. No
          usamos cookies de publicidad ni de rastreo de terceros. Más info en nuestra{" "}
          <Link to="/privacidad" className="text-indigo-600 dark:text-indigo-400 underline underline-offset-2">
            Política de Privacidad
          </Link>
          .
        </p>
        <Button
          onClick={aceptar}
          className="w-full sm:w-auto shrink-0 bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 text-white font-bold"
        >
          Aceptar
        </Button>
      </div>
    </div>
  );
};

export default CookieConsent;
