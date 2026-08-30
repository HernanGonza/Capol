import { lazy, Suspense, useState } from "react";
import type { EmojiStyle, Theme } from "emoji-picker-react";
import { Smile } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useTheme } from "@/hooks/use-theme";

// Biblioteca completa de emojis (todas las categorías: gente, animales,
// comida, actividades, viajes, objetos, símbolos y banderas de todos los
// países). Usamos el set "nativo" del sistema operativo: no descarga
// imágenes de ningún CDN y siempre está al día con el dispositivo del
// usuario. El bundle del picker se carga solo cuando se abre por primera
// vez (lazy) para no pesar en la carga inicial del chat.
const EmojiPicker = lazy(() => import("emoji-picker-react"));

// Los enums EmojiStyle.NATIVE y Theme.LIGHT/DARK son literalmente estos
// strings en runtime; los casteamos para no importar los enums (que
// ejecutarían el índice del paquete y romperían el lazy-load).
const NATIVE = "native" as EmojiStyle;
const asTheme = (t: "light" | "dark") => t as Theme;

interface EmojiPickerButtonProps {
  onPick: (emoji: string) => void;
  disabled?: boolean;
}

const EmojiPickerButton = ({ onPick, disabled }: EmojiPickerButtonProps) => {
  const [open, setOpen] = useState(false);
  const { theme } = useTheme();

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="shrink-0"
          disabled={disabled}
          aria-label="Insertar emoji"
        >
          <Smile className="w-4 h-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        side="top"
        className="w-auto border-none p-0 shadow-xl"
      >
        <Suspense
          fallback={
            <div className="flex h-[400px] w-[320px] items-center justify-center text-sm text-muted-foreground">
              Cargando emojis…
            </div>
          }
        >
          <EmojiPicker
            emojiStyle={NATIVE}
            theme={asTheme(theme === "dark" ? "dark" : "light")}
            lazyLoadEmojis
            searchPlaceholder="Buscar…"
            width={320}
            height={400}
            previewConfig={{ showPreview: false }}
            onEmojiClick={(data) => {
              onPick(data.emoji);
              setOpen(false);
            }}
          />
        </Suspense>
      </PopoverContent>
    </Popover>
  );
};

export default EmojiPickerButton;
