import { usePriceDisplay } from "@/hooks/use-price-display";

interface PriceTagProps {
  usdAmount: number;
  suffix?: string;
  showUsdReference?: boolean;
  className?: string;
  // Cotización propia del curso (cargada a mano por el admin). Si no se
  // pasa, se usa el fallback fijo global ($1500).
  arsRate?: number | null;
}

// Muestra un precio cargado en USD: en pesos argentinos (cotización fija
// del curso, o la global por defecto) si el visitante está en Argentina, en
// dólares para cualquier otro país.
const PriceTag = ({ usdAmount, suffix, showUsdReference, className, arsRate }: PriceTagProps) => {
  const { isArgentina, format } = usePriceDisplay();

  return (
    <span className={className}>
      {format(usdAmount, arsRate)}
      {suffix}
      {showUsdReference && isArgentina && (
        <span className="text-xs text-muted-foreground ml-1.5">(USD {usdAmount.toLocaleString("es-AR")})</span>
      )}
    </span>
  );
};

export default PriceTag;
