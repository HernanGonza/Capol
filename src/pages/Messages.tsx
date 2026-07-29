import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Search, Send, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";

type Mensaje = {
  id: string;
  remitente_id: string;
  destinatario_id: string;
  curso_id: string | null;
  contenido: string;
  leido: boolean;
  creado_en: string;
  remitente: { nombre_completo: string | null; url_avatar: string | null } | null;
  destinatario: { nombre_completo: string | null; url_avatar: string | null } | null;
  cursos: { titulo: string } | null;
};

type Conversation = {
  otherId: string;
  nombre: string;
  avatar: string | null;
  mensajes: Mensaje[];
  ultimo: Mensaje | null;
  noLeidos: number;
  cursoId: string | null;
  cursoTitulo: string | null;
};

const Messages = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [reply, setReply] = useState("");

  const withParam = searchParams.get("with");
  const cursoParam = searchParams.get("curso");

  const { data: mensajes } = useQuery({
    queryKey: ["mensajes", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("mensajes")
        .select(
          "*, remitente:remitente_id(nombre_completo, url_avatar), destinatario:destinatario_id(nombre_completo, url_avatar), cursos:curso_id(titulo)"
        )
        .order("creado_en", { ascending: true });
      if (error) throw error;
      return (data || []) as unknown as Mensaje[];
    },
    enabled: !!user,
    refetchInterval: 15000,
  });

  // Perfil de alguien con quien todavía no hay ningún mensaje (deep-link "Mensaje" desde otra página)
  const { data: freshProfile } = useQuery({
    queryKey: ["perfil-basico", withParam],
    queryFn: async () => {
      const { data } = await supabase
        .from("perfiles")
        .select("id, nombre_completo, url_avatar")
        .eq("id", withParam!)
        .single();
      return data;
    },
    enabled: !!withParam,
  });

  const conversations = useMemo<Conversation[]>(() => {
    if (!user || !mensajes) return [];
    const map = new Map<string, Conversation>();

    for (const m of mensajes) {
      const otherId = m.remitente_id === user.id ? m.destinatario_id : m.remitente_id;
      const otherProfile = m.remitente_id === user.id ? m.destinatario : m.remitente;
      const entry =
        map.get(otherId) ||
        ({
          otherId,
          nombre: otherProfile?.nombre_completo || "Usuario",
          avatar: otherProfile?.url_avatar || null,
          mensajes: [],
          ultimo: null,
          noLeidos: 0,
          cursoId: null,
          cursoTitulo: null,
        } as Conversation);

      entry.mensajes.push(m);
      entry.ultimo = m; // los mensajes vienen ordenados asc, el último de la lista queda al final
      if (m.curso_id) {
        entry.cursoId = m.curso_id;
        entry.cursoTitulo = m.cursos?.titulo || entry.cursoTitulo;
      }
      if (m.destinatario_id === user.id && !m.leido) entry.noLeidos += 1;
      map.set(otherId, entry);
    }

    if (withParam && freshProfile && !map.has(withParam)) {
      map.set(withParam, {
        otherId: withParam,
        nombre: freshProfile.nombre_completo || "Usuario",
        avatar: freshProfile.url_avatar,
        mensajes: [],
        ultimo: null,
        noLeidos: 0,
        cursoId: cursoParam,
        cursoTitulo: null,
      });
    }

    return Array.from(map.values()).sort((a, b) => {
      const da = a.ultimo ? new Date(a.ultimo.creado_en).getTime() : Infinity;
      const db = b.ultimo ? new Date(b.ultimo.creado_en).getTime() : Infinity;
      return db - da;
    });
  }, [mensajes, user, withParam, freshProfile, cursoParam]);

  const filtered = useMemo(
    () => conversations.filter((c) => c.nombre.toLowerCase().includes(search.toLowerCase())),
    [conversations, search]
  );

  const selected = conversations.find((c) => c.otherId === selectedId) || null;

  useEffect(() => {
    if (withParam) setSelectedId(withParam);
  }, [withParam]);

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

  useEffect(() => {
    if (selected && selected.noLeidos > 0) markReadMutation.mutate(selected.otherId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.otherId]);

  const sendMutation = useMutation({
    mutationFn: async () => {
      if (!selected || !reply.trim()) return;
      const { error } = await supabase.from("mensajes").insert({
        remitente_id: user!.id,
        destinatario_id: selected.otherId,
        curso_id: selected.cursoId,
        contenido: reply.trim(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setReply("");
      queryClient.invalidateQueries({ queryKey: ["mensajes", user?.id] });
    },
    onError: (e: any) => toast.error(e.message || "No se pudo enviar el mensaje"),
  });

  const handleClose = (open: boolean) => {
    if (!open) {
      setSelectedId(null);
      if (withParam) {
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
          <p className="text-muted-foreground">Conversaciones con profesores, alumnos y administración</p>
        </div>

        <Card className="bg-muted/30 border-none shadow-none">
          <CardContent className="p-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nombre..."
                className="pl-9 bg-background"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-3">
          {filtered.map((c) => (
            <Card
              key={c.otherId}
              className={`cursor-pointer transition-all shadow-card hover:border-primary/40 ${
                c.noLeidos > 0 ? "border-primary/60 ring-1 ring-primary/30" : ""
              }`}
              onClick={() => setSelectedId(c.otherId)}
            >
              <CardContent className="p-4 flex items-center gap-4">
                {c.avatar ? (
                  <img src={c.avatar} alt={c.nombre} className="w-11 h-11 rounded-full object-cover shrink-0" />
                ) : (
                  <div className="w-11 h-11 rounded-full gradient-hero flex items-center justify-center text-white font-bold shrink-0">
                    {c.nombre[0]?.toUpperCase()}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold truncate">{c.nombre}</h3>
                    {c.noLeidos > 0 && (
                      <Badge className="bg-primary text-primary-foreground border-none">
                        {c.noLeidos} nuevo{c.noLeidos > 1 ? "s" : ""}
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground truncate">
                    {c.ultimo ? c.ultimo.contenido : "Todavía no hay mensajes — escribí el primero"}
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
              <p className="text-muted-foreground">No tenés conversaciones todavía.</p>
            </div>
          )}
        </div>
      </div>

      <Dialog open={!!selected} onOpenChange={handleClose}>
        <DialogContent className="max-w-lg flex flex-col max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>{selected?.nombre}</DialogTitle>
            {selected?.cursoTitulo && (
              <p className="text-xs text-muted-foreground -mt-1">Sobre: {selected.cursoTitulo}</p>
            )}
          </DialogHeader>
          <div className="flex-1 overflow-y-auto space-y-3 py-2 pr-1">
            {selected?.mensajes.map((m) => {
              const mine = m.remitente_id === user?.id;
              return (
                <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm ${
                      mine ? "bg-primary text-primary-foreground rounded-br-sm" : "bg-muted rounded-bl-sm"
                    }`}
                  >
                    <p className="whitespace-pre-wrap break-words">{m.contenido}</p>
                    <p className={`text-[10px] mt-1 ${mine ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                      {format(parseISO(m.creado_en), "dd/MM/yyyy HH:mm")}
                    </p>
                  </div>
                </div>
              );
            })}
            {selected && selected.mensajes.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-8">Escribí el primer mensaje.</p>
            )}
          </div>
          <div className="flex gap-2 pt-2 border-t">
            <Textarea
              placeholder="Escribí un mensaje..."
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  sendMutation.mutate();
                }
              }}
              className="resize-none"
              rows={2}
            />
            <Button
              className="gradient-primary text-primary-foreground shrink-0"
              disabled={!reply.trim() || sendMutation.isPending}
              onClick={() => sendMutation.mutate()}
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
};

export default Messages;
