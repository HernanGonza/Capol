import { useEffect, useState } from "react";
import { detectCountryCode, ARS_FIXED_RATE, formatMoney } from "@/lib/currency";

interface PriceDisplayState {
  isArgentina: boolean;
  loading: boolean;
}

// Precio automático que ve un visitante (landing, catálogo de cursos): si
// está en Argentina se muestra en pesos a la cotización fija ($1500), sin
// importar el país se muestra directo en dólares. Nada de tasas en vivo ni
// de las ~40 monedas que manejaba el conversor viejo — eso generaba anchos
// de texto muy distintos entre tarjeta y tarjeta (Guaraníes, Yenes, etc.)
// y se veía desprolijo. El conversor manual de divisas (CurrencyConverter)
// sigue existiendo aparte para consultar cualquier otro país a mano.
export const usePriceDisplay = () => {
  const [state, setState] = useState<PriceDisplayState>({ isArgentina: false, loading: true });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const countryCode = await detectCountryCode();
      if (cancelled) return;
      setState({ isArgentina: countryCode === "AR", loading: false });
    })();
    return () => { cancelled = true; };
  }, []);

  // "arsRate" opcional: cotización propia del curso (cargada a mano por el
  // admin junto al precio) — si no está cargada, cae al valor fijo global.
  const format = (usdAmount: number, arsRate?: number | null) =>
    state.isArgentina ? formatMoney(usdAmount * (arsRate || ARS_FIXED_RATE), "ARS") : formatMoney(usdAmount, "USD");

  return { ...state, format };
};
