import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Paperclip, Send, X } from "lucide-react";
import { toast } from "sonner";
import { ACCEPTED_ATTACHMENT_TYPES, MAX_ATTACHMENT_SIZE } from "@/lib/messageAttachments";
import EmojiPickerButton from "@/components/EmojiPickerButton";

interface MessageComposerProps {
  value: string;
  onChange: (v: string) => void;
  file: File | null;
  onFileChange: (f: File | null) => void;
  onSend: () => void;
  sending: boolean;
  placeholder?: string;
}

// Cooldown anti-spam del lado del cliente: refleja en la UI el mismo límite
// de 5 segundos que ya se aplica en la base (función
// "dentro_de_cooldown_mensajes"). Esto es solo para dar feedback visual —
// la protección real está en la RLS, no acá.
const COOLDOWN_MS = 5000;

const MessageComposer = ({ value, onChange, file, onFileChange, onSend, sending, placeholder }: MessageComposerProps) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [cooldownUntil, setCooldownUntil] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(0);

  useEffect(() => {
    if (!cooldownUntil) return;
    const tick = () => {
      const left = Math.ceil((cooldownUntil - Date.now()) / 1000);
      setSecondsLeft(left > 0 ? left : 0);
    };
    tick();
    const interval = setInterval(tick, 250);
    return () => clearInterval(interval);
  }, [cooldownUntil]);

  const handlePick = (f: File | null) => {
    if (f && f.size > MAX_ATTACHMENT_SIZE) {
      toast.error("El archivo no puede superar los 20MB");
      return;
    }
    onFileChange(f);
  };

  // Inserta el emoji en la posición del cursor (o al final si el textarea
  // no tiene foco) y deja el cursor justo después del emoji insertado.
  const handleEmoji = (emoji: string) => {
    const el = textareaRef.current;
    const start = el?.selectionStart ?? value.length;
    const end = el?.selectionEnd ?? value.length;
    const next = value.slice(0, start) + emoji + value.slice(end);
    onChange(next);
    requestAnimationFrame(() => {
      if (!el) return;
      el.focus();
      const pos = start + emoji.length;
      el.setSelectionRange(pos, pos);
    });
  };

  const handleSend = () => {
    onSend();
    setCooldownUntil(Date.now() + COOLDOWN_MS);
  };

  const inCooldown = secondsLeft > 0;

  return (
    <div className="border-t pt-2 space-y-2 shrink-0">
      {file && (
        <div className="flex items-center gap-2 bg-muted rounded-lg px-3 py-1.5 text-xs w-fit max-w-full">
          <Paperclip className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate">{file.name}</span>
          <button
            type="button"
            onClick={() => {
              onFileChange(null);
              if (inputRef.current) inputRef.current.value = "";
            }}
            className="shrink-0 text-muted-foreground hover:text-foreground"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
      <div className="flex gap-2">
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED_ATTACHMENT_TYPES}
          className="hidden"
          onChange={(e) => handlePick(e.target.files?.[0] || null)}
        />
        <Button type="button" variant="outline" size="icon" className="shrink-0" onClick={() => inputRef.current?.click()}>
          <Paperclip className="w-4 h-4" />
        </Button>
        <EmojiPickerButton onPick={handleEmoji} disabled={sending} />
        <Textarea
          ref={textareaRef}
          placeholder={placeholder || "Escribí un mensaje..."}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              if (!inCooldown) handleSend();
            }
          }}
          className="resize-none"
          rows={2}
        />
        <Button
          className="gradient-primary text-primary-foreground shrink-0"
          disabled={(!value.trim() && !file) || sending || inCooldown}
          title={inCooldown ? `Esperá ${secondsLeft}s antes de mandar otro mensaje` : undefined}
          onClick={handleSend}
        >
          <Send className="w-4 h-4" />
        </Button>
      </div>
      {inCooldown && (
        <p className="text-[11px] text-muted-foreground">Podés mandar otro mensaje en {secondsLeft}s</p>
      )}
    </div>
  );
};

export default MessageComposer;
