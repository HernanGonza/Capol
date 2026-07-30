import { useEffect, useState } from "react";
import {
  detectUserCurrency,
  getExchangeRates,
  convertUsdToCurrency,
  convertCurrencyToUsd,
  formatMoney,
} from "@/lib/currency";

interface CurrencyConversionState {
  currency: string;
  rates: Record<string, number> | null;
  loading: boolean;
}

// Detecta la moneda del visitante (por IP) y trae las tasas de cambio una
// sola vez por sesión de componente. Si algo falla, cae en USD sin romper
// la UI — el precio en dólares es siempre un fallback válido.
export const useCurrencyConversion = () => {
  const [state, setState] = useState<CurrencyConversionState>({
    currency: "USD",
    rates: null,
    loading: true,
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [currency, rates] = await Promise.all([detectUserCurrency(), getExchangeRates()]);
      if (cancelled) return;
      const resolvedCurrency = currency && rates?.[currency] ? currency : "USD";
      setState({ currency: resolvedCurrency, rates, loading: false });
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const usdToLocal = (amountUsd: number) => convertUsdToCurrency(amountUsd, state.currency, state.rates);
  const toUsd = (amount: number, fromCurrency: string) => convertCurrencyToUsd(amount, fromCurrency, state.rates);

  return { ...state, usdToLocal, toUsd, formatMoney };
};
