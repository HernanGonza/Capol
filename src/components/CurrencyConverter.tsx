import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useCurrencyConversion } from "@/hooks/use-currency-conversion";
import { COUNTRY_TO_CURRENCY, COUNTRY_NAMES } from "@/lib/currency";
import { Globe } from "lucide-react";

const PAISES = Object.keys(COUNTRY_TO_CURRENCY).sort((a, b) =>
  (COUNTRY_NAMES[a] || a).localeCompare(COUNTRY_NAMES[b] || b)
);

interface CurrencyConverterProps {
  className?: string;
  compact?: boolean;
}

// Conversor instantáneo para el admin: elegís el país del alumno y ves al
// toque cuánto equivale en su moneda (o al revés) — pensado para cuando hay
// que decidir/corregir el monto de un pago sin tener que buscar la
// cotización en otro lado.
const CurrencyConverter = ({ className, compact }: CurrencyConverterProps) => {
  const { rates } = useCurrencyConversion();
  const [pais, setPais] = useState("AR");
  const [usd, setUsd] = useState("");
  const currency = COUNTRY_TO_CURRENCY[pais] || "USD";

  const local = useMemo(() => {
    const amount = parseFloat(usd) || 0;
    if (!rates || currency === "USD") return amount;
    const rate = rates[currency];
    return rate ? amount * rate : amount;
  }, [usd, rates, currency]);

  const handleLocalChange = (value: string) => {
    const amount = parseFloat(value);
    if (Number.isNaN(amount)) {
      setUsd("");
      return;
    }
    if (!rates || currency === "USD" || !rates[currency]) {
      setUsd(value);
      return;
    }
    setUsd((amount / rates[currency]).toFixed(2));
  };

  return (
    <Card className={className}>
      <CardHeader className={compact ? "pb-2" : "pb-3"}>
        <CardTitle className="text-base flex items-center gap-2">
          <Globe className="w-4 h-4 text-primary" /> Conversor de Monedas
        </CardTitle>
      </CardHeader>
      <CardContent className={`grid grid-cols-1 ${compact ? "" : "md:grid-cols-3"} gap-3 items-end`}>
        <div className="space-y-1.5">
          <Label className="text-xs">País del alumno</Label>
          <Select value={pais} onValueChange={setPais}>
            <SelectTrigger className="bg-background">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="max-h-72">
              {PAISES.map((code) => (
                <SelectItem key={code} value={code}>
                  {COUNTRY_NAMES[code] || code} ({COUNTRY_TO_CURRENCY[code]})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Monto en USD</Label>
          <Input
            type="number"
            className="bg-background"
            value={usd}
            onChange={(e) => setUsd(e.target.value)}
            placeholder="0.00"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Equivalente en {currency}</Label>
          <Input
            type="number"
            className="bg-background"
            value={local ? local.toFixed(2) : ""}
            onChange={(e) => handleLocalChange(e.target.value)}
            placeholder="0.00"
          />
        </div>
      </CardContent>
    </Card>
  );
};

export default CurrencyConverter;
