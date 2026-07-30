import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useCurrencyConversion } from "@/hooks/use-currency-conversion";
import { COUNTRY_TO_CURRENCY, COUNTRY_NAMES } from "@/lib/currency";
import { Globe, RotateCcw } from "lucide-react";

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
// cotización en otro lado. La cotización se puede editar a mano (por si la
// automática no coincide con lo que le están cobrando realmente al alumno,
// o para poder mostrarla si preguntan) — al tocarla, los montos se
// recalculan solos.
const CurrencyConverter = ({ className, compact }: CurrencyConverterProps) => {
  const { rates } = useCurrencyConversion();
  const [pais, setPais] = useState("AR");
  const [usd, setUsd] = useState("");
  const [customRate, setCustomRate] = useState("");
  const currency = COUNTRY_TO_CURRENCY[pais] || "USD";
  const liveRate = currency === "USD" ? 1 : rates?.[currency];

  // Si cambia el país, la cotización manual anterior (de otra moneda) ya no aplica.
  useEffect(() => {
    setCustomRate("");
  }, [pais]);

  const effectiveRate = customRate !== "" ? parseFloat(customRate) || 0 : liveRate;
  const isCustom = customRate !== "";

  const local = useMemo(() => {
    const amount = parseFloat(usd) || 0;
    if (!effectiveRate || currency === "USD") return amount;
    return amount * effectiveRate;
  }, [usd, effectiveRate, currency]);

  const handleLocalChange = (value: string) => {
    const amount = parseFloat(value);
    if (Number.isNaN(amount)) {
      setUsd("");
      return;
    }
    if (!effectiveRate || currency === "USD") {
      setUsd(value);
      return;
    }
    setUsd((amount / effectiveRate).toFixed(2));
  };

  return (
    <Card className={className}>
      <CardHeader className={compact ? "pb-2" : "pb-3"}>
        <CardTitle className="text-base flex items-center gap-2">
          <Globe className="w-4 h-4 text-primary" /> Conversor de Monedas
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
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
        </div>

        {currency !== "USD" && (
          <div className="flex items-end gap-2 pt-1 border-t">
            <div className="space-y-1.5 flex-1">
              <Label className="text-xs flex items-center gap-1.5">
                Cotización (1 USD = {currency})
                {isCustom && <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase">Manual</span>}
              </Label>
              <Input
                type="number"
                className="bg-background"
                value={customRate !== "" ? customRate : liveRate?.toFixed(4) || ""}
                onChange={(e) => setCustomRate(e.target.value)}
                placeholder="Cotización del día"
              />
            </div>
            {isCustom && (
              <Button type="button" variant="outline" size="icon" title="Volver a la cotización automática" onClick={() => setCustomRate("")}>
                <RotateCcw className="w-4 h-4" />
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default CurrencyConverter;
