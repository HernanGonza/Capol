import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, MessageSquare, Users, Ban, ShieldCheck, Pin, PinOff, Trash2, Flag, AlertTriangle, Pencil } from "lucide-react";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import MessageComposer from "@/components/MessageComposer";
import MessageAttachmentChip from "@/components/MessageAttachmentChip";
import { uploadMessageAttachment } from "@/lib/messageAttachments";

type Mensaje = {
  id: string;
  remitente_id: string;
  destinatario_id: string | null;
  curso_id: string | null;
  contenido: string;
  leido: boolean;
  eliminado: boolean;
  fijado: boolean;
  editado: boolean;
  creado_en: string;
  adjunto_path: string | null;
  adjunto_nombre: string | null;
  cursos: { titulo: string } | null;
};

type PerfilPublico = { id: string; nombre_completo: string | null; url_avatar: string | null };

type ConversationDirecta = {
  key: string;
  tipo: "directo";
  otherId: string;
  nombre: string;
  avatar: string | null;
  mensajes: Mensaje[];
  ultimo: Mensaje | null;
  noLeidos: number;
  cursoId: string | null;
  cursoTitulo: string | null;
};

type ConversationForo = {
  key: string;
  tipo: "foro";
  cursoId: string;
  nombre: string;
  cursoTitulo: string;
  mensajes: Mensaje[];
  ultimo: Mensaje | null;
};

type Conversation = ConversationDirecta | ConversationForo;

type ConfirmAction =
  | { type: "ban-reported"; remitenteId: string; nombre: string }
  | { type: "toggle-ban-chat"; otherId: string; nombre: string; bloqueado: boolean }
  | { type: "delete-message"; mensajeId: string };

const confirmActionCopy = (action: ConfirmAction): { title: string; description: string; confirmLabel: string; destructive: boolean } => {
  switch (action.type) {
    case "ban-reported":
      return {
        title: "¿Banear a este usuario?",
        description: `${action.nombre} no va a poder mandar más mensajes.`,
        confirmLabel: "Banear",
        destructive: true,
      };
    case "toggle-ban-chat":
      return action.bloqueado
        ? {
            title: "¿Desbloquear a este usuario?",
            description: `${action.nombre} va a poder volver a mandar mensajes.`,
            confirmLabel: "Desbloquear",
            destructive: false,
          }
        : {
            title: "¿Bloquear a este usuario?",
            description: `${action.nombre} no va a poder mandar más mensajes directos ni postear en foros.`,
            confirmLabel: "Bloquear",
            destructive: true,
          };
    case "delete-message":
      return {
        title: "¿Borrar este mensaje?",
        description: "Esta acción no se puede deshacer.",
        confirmLabel: "Borrar",
        destructive: true,
      };
  }
};

const Messages = () => {
  const { user, role } = useAuth();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState("");
  const [tipoFilter, setTipoFilter] = useState<"todos" | "directos" | "foros">("todos");
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [reply, setReply] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);

  const withParam = searchParams.get("with");
  const cursoParam = searchParams.get("curso");

  const { data: mensajes } = useQuery({
    queryKey: ["mensajes", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("mensajes")
        .select("*, cursos:curso_id(titulo)")
        .order("creado_en", { ascending: true });
      if (error) throw error;
      return (data || []) as unknown as Mensaje[];
    },
    enabled: !!user,
    refetchInterval: 60000,
  });

  // "perfiles" solo deja ver la fila propia (o todas si sos admin), así que
  // para mostrar nombre/avatar de OTRAS personas (remitente/destinatario de
  // cada mensaje) hay que resolverlos aparte con una función que expone esos
  // dos datos no sensibles para cualquier usuario autenticado.
  const idsAResolver = useMemo(() => {
    const ids = new Set<string>();
    for (const m of mensajes || []) {
      ids.add(m.remitente_id);
      if (m.destinatario_id) ids.add(m.destinatario_id);
    }
    if (withParam) ids.add(withParam);
    return Array.from(ids);
  }, [mensajes, withParam]);

  const { data: perfilesPublicos } = useQuery({
    queryKey: ["perfiles-publicos", idsAResolver],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("perfiles_publicos", { p_ids: idsAResolver });
      if (error) throw error;
      return (data || []) as PerfilPublico[];
    },
    enabled: idsAResolver.length > 0,
  });

  const profileMap = useMemo(() => {
    const map = new Map<string, PerfilPublico>();
    for (const p of perfilesPublicos || []) map.set(p.id, p);
    return map;
  }, [perfilesPublicos]);

  // El admin tiene que poder ver (y arrancar) el foro de CUALQUIER curso, no
  // solo los que ya tienen mensajes.
  const { data: allCourses } = useQuery({
    queryKey: ["admin-courses-list"],
    queryFn: async () => {
      const { data } = await supabase.from("cursos").select("id, titulo").order("titulo");
      return data || [];
    },
    enabled: role === "admin",
  });

  // Reportes de mensajes pendientes de revisar (solo admin)
  const { data: reportes } = useQuery({
    queryKey: ["reportes-pendientes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("mensajes_reportados")
        .select(
          "*, mensajes:mensaje_id(id, contenido, remitente_id, destinatario_id, curso_id, eliminado, remitente:remitente_id(nombre_completo), cursos:curso_id(titulo)), reportante:reportado_por(nombre_completo)"
        )
        .eq("resuelto", false)
        .order("creado_en", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: role === "admin",
  });

  const conversations = useMemo<Conversation[]>(() => {
    if (!user || !mensajes) return [];
    const map = new Map<string, Conversation>();

    for (const m of mensajes) {
      if (m.destinatario_id === null) {
        if (!m.curso_id) continue;
        const key = `foro-${m.curso_id}`;
        const existing = map.get(key) as ConversationForo | undefined;
        const entry: ConversationForo =
          existing || {
            key,
            tipo: "foro",
            cursoId: m.curso_id,
            nombre: `Foro: ${m.cursos?.titulo || "Curso"}`,
            cursoTitulo: m.cursos?.titulo || "Curso",
            mensajes: [],
            ultimo: null,
          };
        entry.mensajes.push(m);
        entry.ultimo = m;
        map.set(key, entry);
      } else {
        const otherId = m.remitente_id === user.id ? m.destinatario_id : m.remitente_id;
        const otherProfile = profileMap.get(otherId!);
        const key = `dm-${otherId}`;
        const existing = map.get(key) as ConversationDirecta | undefined;
        const entry: ConversationDirecta =
          existing || {
            key,
            tipo: "directo",
            otherId,
            nombre: otherProfile?.nombre_completo || "Usuario",
            avatar: otherProfile?.url_avatar || null,
            mensajes: [],
            ultimo: null,
            noLeidos: 0,
            cursoId: null,
            cursoTitulo: null,
          };
        entry.mensajes.push(m);
        entry.ultimo = m;
        if (m.curso_id) {
          entry.cursoId = m.curso_id;
          entry.cursoTitulo = m.cursos?.titulo || entry.cursoTitulo;
        }
        if (m.destinatario_id === user.id && !m.leido) entry.noLeidos += 1;
        map.set(key, entry);
      }
    }

    if (withParam && !map.has(`dm-${withParam}`)) {
      const freshProfile = profileMap.get(withParam);
      map.set(`dm-${withParam}`, {
        key: `dm-${withParam}`,
        tipo: "directo",
        otherId: withParam,
        nombre: freshProfile?.nombre_completo || "Usuario",
        avatar: freshProfile?.url_avatar || null,
        mensajes: [],
        ultimo: null,
        noLeidos: 0,
        cursoId: cursoParam,
        cursoTitulo: null,
      });
    }

    if (role === "admin" && allCourses) {
      for (const c of allCourses) {
        const key = `foro-${c.id}`;
        if (!map.has(key)) {
          map.set(key, {
            key,
            tipo: "foro",
            cursoId: c.id,
            nombre: `Foro: ${c.titulo}`,
            cursoTitulo: c.titulo,
            mensajes: [],
            ultimo: null,
          });
        }
      }
    }

    return Array.from(map.values()).sort((a, b) => {
      const da = a.ultimo ? new Date(a.ultimo.creado_en).getTime() : -Infinity;
      const db = b.ultimo ? new Date(b.ultimo.creado_en).getTime() : -Infinity;
      return db - da;
    });
  }, [mensajes, user, withParam, profileMap, cursoParam, role, allCourses]);

  const filtered = useMemo(
    () =>
      conversations
        .filter((c) => (tipoFilter === "todos" ? true : tipoFilter === "directos" ? c.tipo === "directo" : c.tipo === "foro"))
        .filter((c) => c.nombre.toLowerCase().includes(search.toLowerCase())),
    [conversations, search, tipoFilter]
  );

  const selected = conversations.find((c) => c.key === selectedKey) || null;

  // Mensajes fijados primero (arriba), el resto en orden cronológico
  const orderedMensajes = useMemo(() => {
    if (!selected) return [];
    if (selected.tipo !== "foro") return selected.mensajes;
    const pinned = selected.mensajes.filter((m) => m.fijado);
    const rest = selected.mensajes.filter((m) => !m.fijado);
    return [...pinned, ...rest];
  }, [selected]);

  useEffect(() => {
    if (withParam) setSelectedKey(`dm-${withParam}`);
  }, [withParam]);

  useEffect(() => {
    if (!withParam && cursoParam) setSelectedKey(`foro-${cursoParam}`);
  }, [withParam, cursoParam]);

  // Estado de baneo de mensajería de la otra persona (solo le interesa al admin)
  const { data: banInfo } = useQuery({
    queryKey: ["mensajeria-bloqueo", selected?.tipo === "directo" ? selected.otherId : null],
    queryFn: async () => {
      const otherId = selected!.tipo === "directo" ? selected!.otherId : "";
      const { data } = await supabase.from("mensajeria_bloqueados").select("usuario_id").eq("usuario_id", otherId).maybeSingle();
      return !!data;
    },
    enabled: role === "admin" && selected?.tipo === "directo",
  });

  const banUserMutation = useMutation({
    mutationFn: async ({ userId, bloqueado }: { userId: string; bloqueado: boolean }) => {
      if (bloqueado) {
        const { error } = await supabase.from("mensajeria_bloqueados").delete().eq("usuario_id", userId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("mensajeria_bloqueados").insert({ usuario_id: userId, bloqueado_por: user!.id });
        if (error) throw error;
      }
    },
    onSuccess: (_, vars) => {
      toast.success(vars.bloqueado ? "Usuario desbloqueado" : "Usuario bloqueado: ya no va a poder mandar mensajes");
      queryClient.invalidateQueries({ queryKey: ["mensajeria-bloqueo"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const markReadMutation = useMutation({
    mutationFn: async (otherId: string) => {
      const { error } = await supabase
        .from("mensajes")
        .update({ leido: true })
        .eq("destinatario_id", user!.id)
        .eq("remitente_id", otherId)
        .eq("leido", false);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["mensajes", user?.id] }),
  });

  // Marca "hasta cuándo leí este foro" para que deje de contar como no leído
  const markForumReadMutation = useMutation({
    mutationFn: async (cursoId: string) => {
      const { error } = await supabase
        .from("foro_ultima_lectura")
        .upsert({ usuario_id: user!.id, curso_id: cursoId, leido_hasta: new Date().toISOString() });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["foro-no-leidos-count", user?.id] }),
  });

  useEffect(() => {
    if (!selected) return;
    if (selected.tipo === "directo" && selected.noLeidos > 0) markReadMutation.mutate(selected.otherId);
    if (selected.tipo === "foro") markForumReadMutation.mutate(selected.cursoId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.key]);

  const sendMutation = useMutation({
    mutationFn: async () => {
      if (!selected || (!reply.trim() && !file)) return;
      const messageId = crypto.randomUUID();
      let adjunto_path: string | null = null;
      if (file) adjunto_path = await uploadMessageAttachment(messageId, file);

      const payload =
        selected.tipo === "directo"
          ? {
              id: messageId,
              remitente_id: user!.id,
              destinatario_id: selected.otherId,
              curso_id: selected.cursoId,
              contenido: reply.trim(),
              adjunto_path,
              adjunto_nombre: file?.name || null,
            }
          : {
              id: messageId,
              remitente_id: user!.id,
              destinatario_id: null,
              curso_id: selected.cursoId,
              contenido: reply.trim(),
              adjunto_path,
              adjunto_nombre: file?.name || null,
            };
      const { error } = await supabase.from("mensajes").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      setReply("");
      setFile(null);
      queryClient.invalidateQueries({ queryKey: ["mensajes", user?.id] });
    },
    onError: (e: any) => toast.error(e.message || "No se pudo enviar el mensaje"),
  });

  const pinMutation = useMutation({
    mutationFn: async ({ mensajeId, fijar }: { mensajeId: string; fijar: boolean }) => {
      const { error } = await supabase.rpc("fijar_mensaje_foro", { p_mensaje_id: mensajeId, p_fijar: fijar });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mensajes", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["foro-curso"] });
    },
    onError: (e: any) => toast.error(e.message || "No se pudo fijar el mensaje"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (mensajeId: string) => {
      const { error } = await supabase.rpc("eliminar_mensaje_propio", { p_mensaje_id: mensajeId });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mensajes", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["foro-curso"] });
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
      queryClient.invalidateQueries({ queryKey: ["mensajes", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["foro-curso"] });
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

  const resolveReportMutation = useMutation({
    mutationFn: async (reportId: string) => {
      const { error } = await supabase.from("mensajes_reportados").update({ resuelto: true }).eq("id", reportId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Reporte marcado como resuelto");
      queryClient.invalidateQueries({ queryKey: ["reportes-pendientes"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const handleClose = (open: boolean) => {
    if (!open) {
      setSelectedKey(null);
      setReply("");
      setFile(null);
      setEditingId(null);
      setEditText("");
      if (withParam || cursoParam) {
        const next = new URLSearchParams(searchParams);
        next.delete("with");
        next.delete("curso");
        setSearchParams(next, { replace: true });
      }
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        <div>
          <h1 className="text-2xl font-bold">Mensajes</h1>
          <p className="text-muted-foreground">Conversaciones directas y foros de curso</p>
        </div>

        {role === "admin" && !!reportes?.length && (
          <Card className="border-amber-300 dark:border-amber-900 shadow-card">
            <CardHeader className="bg-amber-50 dark:bg-amber-950/30 border-b border-amber-200 dark:border-amber-900 py-3">
              <CardTitle className="text-sm font-bold flex items-center gap-2 text-amber-800 dark:text-amber-400">
                <AlertTriangle className="w-4 h-4" /> Mensajes Reportados ({reportes.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y">
                {reportes.map((r: any) => (
                  <div key={r.id} className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm">
                        <span className="font-bold">{r.reportante?.nombre_completo || "Alguien"}</span> reportó un mensaje de{" "}
                        <span className="font-bold">{r.mensajes?.remitente?.nombre_completo || "Usuario"}</span>
                        {r.mensajes?.cursos?.titulo && <> en el foro de <span className="font-bold">{r.mensajes.cursos.titulo}</span></>}
                      </p>
                      <p className="text-sm text-muted-foreground italic truncate">
                        {r.mensajes?.eliminado ? "(el mensaje ya fue borrado)" : `"${r.mensajes?.contenido || "(sin texto)"}"`}
                      </p>
                      {r.motivo && <p className="text-xs text-muted-foreground mt-1">Motivo: {r.motivo}</p>}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {r.mensajes?.destinatario_id === null && r.mensajes?.curso_id && (
                        <Button variant="outline" size="sm" onClick={() => setSelectedKey(`foro-${r.mensajes.curso_id}`)}>
                          Ver Foro
                        </Button>
                      )}
                      {r.mensajes?.remitente_id && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-destructive hover:bg-destructive/10"
                          onClick={() =>
                            setConfirmAction({
                              type: "ban-reported",
                              remitenteId: r.mensajes.remitente_id,
                              nombre: r.mensajes.remitente?.nombre_completo || "este usuario",
                            })
                          }
                        >
                          <Ban className="w-4 h-4 mr-1" /> Banear
                        </Button>
                      )}
                      <Button size="sm" onClick={() => resolveReportMutation.mutate(r.id)} disabled={resolveReportMutation.isPending}>
                        Marcar resuelto
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="bg-muted/30 border-none shadow-none">
          <CardContent className="p-4 flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nombre o curso..."
                className="pl-9 bg-background"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Select value={tipoFilter} onValueChange={(v: any) => setTipoFilter(v)}>
              <SelectTrigger className="w-full md:w-[200px] bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="directos">Mensajes Directos</SelectItem>
                <SelectItem value="foros">Foros de Curso</SelectItem>
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        <div className="grid gap-3">
          {filtered.map((c) => (
            <Card
              key={c.key}
              className={`cursor-pointer transition-all shadow-card hover:border-primary/40 ${
                c.tipo === "directo" && c.noLeidos > 0 ? "border-primary/60 ring-1 ring-primary/30" : ""
              }`}
              onClick={() => setSelectedKey(c.key)}
            >
              <CardContent className="p-4 flex items-center gap-4">
                {c.tipo === "foro" ? (
                  <div className="w-11 h-11 rounded-full bg-indigo-100 dark:bg-indigo-950/40 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
                    <Users className="w-5 h-5" />
                  </div>
                ) : c.avatar ? (
                  <img src={c.avatar} alt={c.nombre} className="w-11 h-11 rounded-full object-cover shrink-0" />
                ) : (
                  <div className="w-11 h-11 rounded-full gradient-hero flex items-center justify-center text-white font-bold shrink-0">
                    {c.nombre[0]?.toUpperCase()}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold truncate">{c.nombre}</h3>
                    {c.tipo === "directo" && c.noLeidos > 0 && (
                      <Badge className="bg-primary text-primary-foreground border-none">
                        {c.noLeidos} nuevo{c.noLeidos > 1 ? "s" : ""}
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground truncate">
                    {c.ultimo
                      ? c.ultimo.eliminado
                        ? "Mensaje eliminado"
                        : c.ultimo.contenido || (c.ultimo.adjunto_nombre ? `📎 ${c.ultimo.adjunto_nombre}` : "")
                      : "Todavía no hay mensajes — escribí el primero"}
                  </p>
                </div>
                {c.ultimo && (
                  <span className="text-xs text-muted-foreground shrink-0">
                    {format(parseISO(c.ultimo.creado_en), "dd/MM HH:mm")}
                  </span>
                )}
              </CardContent>
            </Card>
          ))}

          {filtered.length === 0 && (
            <div className="p-20 text-center border-2 border-dashed rounded-xl bg-muted/20">
              <MessageSquare className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
              <p className="text-muted-foreground">No hay conversaciones que coincidan con el filtro.</p>
            </div>
          )}
        </div>
      </div>

      <Dialog open={!!selected} onOpenChange={handleClose}>
        <DialogContent className="max-w-lg flex flex-col max-h-[90vh]">
          <DialogHeader>
            <div className="flex items-center justify-between gap-2 pr-6">
              <div>
                <DialogTitle>{selected?.tipo === "foro" ? "Foro del Curso" : selected?.nombre}</DialogTitle>
                {selected?.tipo === "foro" && (
                  <p className="text-xs text-muted-foreground">{selected.cursoTitulo}</p>
                )}
                {selected?.tipo === "directo" && selected.cursoTitulo && (
                  <p className="text-xs text-muted-foreground">Sobre: {selected.cursoTitulo}</p>
                )}
              </div>
              {role === "admin" && selected?.tipo === "directo" && (
                <Button
                  variant="outline"
                  size="sm"
                  className={banInfo ? "text-emerald-700 dark:text-emerald-400" : "text-destructive hover:bg-destructive/10"}
                  disabled={banUserMutation.isPending}
                  onClick={() =>
                    setConfirmAction({ type: "toggle-ban-chat", otherId: selected.otherId, nombre: selected.nombre, bloqueado: !!banInfo })
                  }
                >
                  {banInfo ? (
                    <><ShieldCheck className="w-4 h-4 mr-1" /> Desbloquear</>
                  ) : (
                    <><Ban className="w-4 h-4 mr-1" /> Banear</>
                  )}
                </Button>
              )}
            </div>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto space-y-3 py-2 pr-1">
            {orderedMensajes.map((m) => {
              const mine = m.remitente_id === user?.id;
              const puedeFijar = selected?.tipo === "foro" && (role === "admin" || role === "teacher");
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
                    {selected?.tipo === "foro" && !mine && (
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
                      <div className={`absolute top-1 ${mine ? "left-1" : "right-1"} hidden group-hover:flex items-center gap-0.5 bg-background/90 rounded-lg shadow-sm border`}>
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
                            onClick={() => setConfirmAction({ type: "delete-message", mensajeId: m.id })}
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
            {selected && selected.mensajes.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-8">Escribí el primer mensaje.</p>
            )}
          </div>
          <MessageComposer
            value={reply}
            onChange={setReply}
            file={file}
            onFileChange={setFile}
            onSend={() => sendMutation.mutate()}
            sending={sendMutation.isPending}
            placeholder={selected?.tipo === "foro" ? "Escribí algo para todo el curso..." : "Escribí un mensaje..."}
          />
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!confirmAction} onOpenChange={(o) => { if (!o) setConfirmAction(null); }}>
        <AlertDialogContent>
          {confirmAction && (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>{confirmActionCopy(confirmAction).title}</AlertDialogTitle>
                <AlertDialogDescription>{confirmActionCopy(confirmAction).description}</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  className={confirmActionCopy(confirmAction).destructive ? "bg-destructive hover:bg-destructive/90 text-destructive-foreground" : ""}
                  onClick={() => {
                    if (confirmAction.type === "ban-reported") {
                      banUserMutation.mutate({ userId: confirmAction.remitenteId, bloqueado: false });
                    } else if (confirmAction.type === "toggle-ban-chat") {
                      banUserMutation.mutate({ userId: confirmAction.otherId, bloqueado: confirmAction.bloqueado });
                    } else if (confirmAction.type === "delete-message") {
                      deleteMutation.mutate(confirmAction.mensajeId);
                    }
                    setConfirmAction(null);
                  }}
                >
                  {confirmActionCopy(confirmAction).confirmLabel}
                </AlertDialogAction>
              </AlertDialogFooter>
            </>
          )}
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
};

export default Messages;
