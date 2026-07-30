import { useCurrencyConversion } from "@/hooks/use-currency-conversion";

interface PriceTagProps {
  usdAmount: number;
  suffix?: string;
  showUsdReference?: boolean;
  className?: string;
}

// Muestra un precio cargado en USD convertido a la moneda del visitante
// (detectada por IP). Mientras se resuelve la detección, o si no se pudo
// determinar la moneda, muestra el monto en USD directamente.
const PriceTag = ({ usdAmount, suffix, showUsdReference, className }: PriceTagProps) => {
  const { currency, usdToLocal, formatMoney } = useCurrencyConversion();
  const local = usdToLocal(usdAmount);

  return (
    <span className={className}>
      {formatMoney(local, currency)}
      {suffix}
      {showUsdReference && currency !== "USD" && (
        <span className="text-xs text-muted-foreground ml-1.5">(USD {usdAmount.toLocaleString("es-AR")})</span>
      )}
    </span>
  );
};

export default PriceTag;
