import { useState } from "react";
import { Paperclip, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { openMessageAttachment } from "@/lib/messageAttachments";

const MessageAttachmentChip = ({ path, nombre, mine }: { path: string; nombre: string; mine: boolean }) => {
  const [loading, setLoading] = useState(false);

  const handleOpen = async () => {
    setLoading(true);
    try {
      await openMessageAttachment(path);
    } catch (e: any) {
      toast.error("No se pudo abrir el archivo: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleOpen}
      disabled={loading}
      className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium border transition-opacity hover:opacity-80 disabled:opacity-50 ${
        mine ? "bg-primary-foreground/10 border-primary-foreground/20" : "bg-background border-border"
      }`}
    >
      {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" /> : <Paperclip className="w-3.5 h-3.5 shrink-0" />}
      <span className="truncate max-w-[180px]">{nombre}</span>
    </button>
  );
};

export default MessageAttachmentChip;
