import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import MessageComposer from "@/components/MessageComposer";
import MessageAttachmentChip from "@/components/MessageAttachmentChip";
import { uploadMessageAttachment } from "@/lib/messageAttachments";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { Pin, PinOff, Trash2, Flag, Pencil } from "lucide-react";

// Hilo grupal de un curso: cualquier mensaje con destinatario_id null y
// curso_id = courseId. La RLS ya restringe quién puede ver/publicar (admin,
// profesor asignado, o alumno con suscripción activa) — este componente no
// necesita recalcular ese permiso, solo mostrar el hilo.
const CourseForumThread = ({ courseId }: { courseId: string }) => {
  const { user, role } = useAuth();
  const queryClient = useQueryClient();
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const { data: mensajes } = useQuery({
    queryKey: ["foro-curso", courseId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("mensajes")
        .select("*")
        .eq("curso_id", courseId)
        .is("destinatario_id", null)
        .order("creado_en", { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!courseId,
    refetchInterval: 60000,
  });

  // "perfiles" solo deja ver la fila propia (o todas si sos admin); para
  // mostrar el nombre de quien escribió cada mensaje hace falta resolverlo
  // aparte con una función que expone nombre/avatar de cualquier usuario.
  const remitenteIds = useMemo(
    () => Array.from(new Set((mensajes || []).map((m: any) => m.remitente_id))),
    [mensajes]
  );

  const { data: perfilesPublicos } = useQuery({
    queryKey: ["perfiles-publicos", remitenteIds],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("perfiles_publicos", { p_ids: remitenteIds });
      if (error) throw error;
      return data || [];
    },
    enabled: remitenteIds.length > 0,
  });

  const profileMap = useMemo(() => {
    const map = new Map<string, { nombre_completo: string | null; url_avatar: string | null }>();
    for (const p of perfilesPublicos || []) map.set(p.id, p);
    return map;
  }, [perfilesPublicos]);

  const orderedMensajes = useMemo(() => {
    if (!mensajes) return [];
    const pinned = mensajes.filter((m: any) => m.fijado);
    const rest = mensajes.filter((m: any) => !m.fijado);
    return [...pinned, ...rest];
  }, [mensajes]);

  // Marca "hasta cuándo leí este foro" al abrirlo, para el indicador de
  // actividad nueva del sidebar.
  useEffect(() => {
    if (!user || !courseId) return;
    supabase
      .from("foro_ultima_lectura")
      .upsert({ usuario_id: user.id, curso_id: courseId, leido_hasta: new Date().toISOString() })
      .then(() => queryClient.invalidateQueries({ queryKey: ["foro-no-leidos-count", user.id] }));
  }, [user, courseId, queryClient]);

  const sendMutation = useMutation({
    mutationFn: async () => {
      if (!text.trim() && !file) return;
      const messageId = crypto.randomUUID();
      let adjunto_path: string | null = null;
      if (file) adjunto_path = await uploadMessageAttachment(messageId, file);

      const { error } = await supabase.from("mensajes").insert({
        id: messageId,
        remitente_id: user!.id,
        destinatario_id: null,
        curso_id: courseId,
        contenido: text.trim(),
        adjunto_path,
        adjunto_nombre: file?.name || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setText("");
      setFile(null);
      queryClient.invalidateQueries({ queryKey: ["foro-curso", courseId] });
      queryClient.invalidateQueries({ queryKey: ["mensajes", user?.id] });
    },
    onError: (e: any) => toast.error(e.message || "No se pudo publicar el mensaje"),
  });

  const pinMutation = useMutation({
    mutationFn: async ({ mensajeId, fijar }: { mensajeId: string; fijar: boolean }) => {
      const { error } = await supabase.rpc("fijar_mensaje_foro", { p_mensaje_id: mensajeId, p_fijar: fijar });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["foro-curso", courseId] });
      queryClient.invalidateQueries({ queryKey: ["mensajes", user?.id] });
    },
    onError: (e: any) => toast.error(e.message || "No se pudo fijar el mensaje"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (mensajeId: string) => {
      const { error } = await supabase.rpc("eliminar_mensaje_propio", { p_mensaje_id: mensajeId });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["foro-curso", courseId] });
      queryClient.invalidateQueries({ queryKey: ["mensajes", user?.id] });
    },
    onError: (e: any) => toast.error(e.message || "No se pudo borrar el mensaje"),
  });

  const editMutation = useMutation({
    mutationFn: async ({ mensajeId, contenido }: { mensajeId: string; contenido: string }) => {
      const { error } = await supabase.rpc("editar_mensaje_propio", { p_mensaje_id: mensajeId, p_contenido: contenido });
      if (error) throw error;
    },
    onSuccess: () => {
      setEditingId(null);
      setEditText("");
      queryClient.invalidateQueries({ queryKey: ["foro-curso", courseId] });
      queryClient.invalidateQueries({ queryKey: ["mensajes", user?.id] });
    },
    onError: (e: any) => toast.error(e.message || "No se pudo editar el mensaje"),
  });

  const reportMutation = useMutation({
    mutationFn: async ({ mensajeId, motivo }: { mensajeId: string; motivo: string | null }) => {
      const { error } = await supabase.from("mensajes_reportados").insert({ mensaje_id: mensajeId, reportado_por: user!.id, motivo });
      if (error) throw error;
    },
    onSuccess: () => toast.success("Reporte enviado. El admin lo va a revisar."),
    onError: (e: any) => toast.error(e.message || "No se pudo reportar el mensaje"),
  });

  const puedeFijar = role === "admin" || role === "teacher";

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex-1 min-h-0 overflow-y-auto space-y-3 py-2 pr-1">
        {orderedMensajes.map((m: any) => {
          const mine = m.remitente_id === user?.id;
          const canEdit = mine && !m.eliminado && Date.now() - new Date(m.creado_en).getTime() < 15 * 60 * 1000;
          return (
            <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div
                className={`group relative max-w-[80%] rounded-2xl px-4 py-2 text-sm space-y-1.5 ${
                  mine ? "bg-primary text-primary-foreground rounded-br-sm" : "bg-muted rounded-bl-sm"
                } ${m.fijado ? "ring-2 ring-amber-400" : ""}`}
              >
                {m.fijado && (
                  <p className={`text-[10px] font-black uppercase tracking-wide flex items-center gap-1 ${mine ? "text-primary-foreground/80" : "text-amber-600 dark:text-amber-400"}`}>
                    <Pin className="w-3 h-3" /> Fijado
                  </p>
                )}
                {!mine && (
                  <p className="text-xs font-bold opacity-80">{profileMap.get(m.remitente_id)?.nombre_completo || "Usuario"}</p>
                )}
                {m.eliminado ? (
                  <p className={`italic ${mine ? "text-primary-foreground/70" : "text-muted-foreground"}`}>Mensaje eliminado</p>
                ) : editingId === m.id ? (
                  <div className="space-y-1.5">
                    <Textarea
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      autoFocus
                      rows={2}
                      className={`resize-none text-sm ${mine ? "bg-primary-foreground/10 border-primary-foreground/30 text-primary-foreground placeholder:text-primary-foreground/50" : "bg-background"}`}
                    />
                    <div className="flex justify-end gap-1.5">
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className={`h-7 px-2 text-xs ${mine ? "text-primary-foreground/80 hover:text-primary-foreground hover:bg-primary-foreground/10" : ""}`}
                        onClick={() => setEditingId(null)}
                      >
                        Cancelar
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        className="h-7 px-2 text-xs"
                        disabled={editMutation.isPending || !editText.trim()}
                        onClick={() => editMutation.mutate({ mensajeId: m.id, contenido: editText })}
                      >
                        Guardar
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    {m.contenido && <p className="whitespace-pre-wrap break-words">{m.contenido}</p>}
                    {m.adjunto_path && (
                      <MessageAttachmentChip path={m.adjunto_path} nombre={m.adjunto_nombre || "Archivo"} mine={mine} />
                    )}
                  </>
                )}
                <p className={`text-[10px] ${mine ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                  {format(parseISO(m.creado_en), "dd/MM/yyyy HH:mm")}
                  {m.editado && !m.eliminado && <span className="italic"> (editado)</span>}
                </p>

                {!m.eliminado && editingId !== m.id && (
                  <div className={`absolute top-1 ${mine ? "left-1" : "right-1"} flex md:hidden md:group-hover:flex items-center gap-0.5 bg-background/90 rounded-lg shadow-sm border`}>
                    {puedeFijar && (
                      <button
                        type="button"
                        title={m.fijado ? "Desfijar" : "Fijar"}
                        className="p-1.5 text-muted-foreground hover:text-amber-600"
                        onClick={() => pinMutation.mutate({ mensajeId: m.id, fijar: !m.fijado })}
                      >
                        {m.fijado ? <PinOff className="w-3.5 h-3.5" /> : <Pin className="w-3.5 h-3.5" />}
                      </button>
                    )}
                    {canEdit && (
                      <button
                        type="button"
                        title="Editar mensaje"
                        className="p-1.5 text-muted-foreground hover:text-primary"
                        onClick={() => { setEditingId(m.id); setEditText(m.contenido); }}
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {mine ? (
                      <button
                        type="button"
                        title="Borrar mensaje"
                        className="p-1.5 text-muted-foreground hover:text-destructive"
                        onClick={() => setDeleteConfirmId(m.id)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    ) : (
                      <button
                        type="button"
                        title="Reportar mensaje"
                        className="p-1.5 text-muted-foreground hover:text-amber-600"
                        onClick={() => {
                          const motivo = window.prompt("Motivo del reporte (opcional):");
                          if (motivo !== null) reportMutation.mutate({ mensajeId: m.id, motivo: motivo.trim() || null });
                        }}
                      >
                        <Flag className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
        {mensajes?.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-8">
            Todavía no hay mensajes en el foro. ¡Escribí el primero!
          </p>
        )}
      </div>
      <MessageComposer
        value={text}
        onChange={setText}
        file={file}
        onFileChange={setFile}
        onSend={() => sendMutation.mutate()}
        sending={sendMutation.isPending}
        placeholder="Escribí algo para todo el curso..."
      />

      <AlertDialog open={!!deleteConfirmId} onOpenChange={(o) => !o && setDeleteConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Borrar este mensaje?</AlertDialogTitle>
            <AlertDialogDescription>Esta acción no se puede deshacer.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
              disabled={deleteMutation.isPending}
              onClick={() => {
                if (deleteConfirmId) deleteMutation.mutate(deleteConfirmId);
                setDeleteConfirmId(null);
              }}
            >
              Borrar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default CourseForumThread;
