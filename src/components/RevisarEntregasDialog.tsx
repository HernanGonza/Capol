import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";
import { CheckCircle, Clock, FileText, Link2, User } from "lucide-react";

interface RevisarEntregasDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lesson: { id: string; titulo: string } | null;
}

// El profesor revisa acá los trabajos finales que subieron los alumnos en la
// última clase del curso, y recién cuando aprueba uno, esa clase le queda
// completada al alumno (antes el alumno se la auto-completaba con solo entregar).
const RevisarEntregasDialog = ({ open, onOpenChange, lesson }: RevisarEntregasDialogProps) => {
  const queryClient = useQueryClient();
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});

  const { data: entregas, isLoading } = useQuery({
    queryKey: ["entregas-trabajo-final", lesson?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("entregas_trabajo_final")
        .select("*")
        .eq("leccion_id", lesson!.id)
        .order("creado_en", { ascending: true });
      if (error) throw error;

      const { data: progress } = await supabase
        .from("progreso_lecciones")
        .select("usuario_id, completado")
        .eq("leccion_id", lesson!.id);

      return (data || []).map((e: any) => ({
        ...e,
        aprobado: progress?.some((p: any) => p.usuario_id === e.usuario_id && p.completado) || false,
      }));
    },
    enabled: open && !!lesson,
  });

  // "perfiles" solo deja ver la fila propia (o todas si sos admin) — para
  // mostrar el nombre del alumno que entregó hace falta resolverlo aparte con
  // una función que expone nombre/avatar de cualquier usuario.
  const { data: perfilesPublicos } = useQuery({
    queryKey: ["perfiles-publicos", (entregas || []).map((e: any) => e.usuario_id)],
    queryFn: async () => {
      const ids = Array.from(new Set((entregas || []).map((e: any) => e.usuario_id)));
      const { data, error } = await supabase.rpc("perfiles_publicos", { p_ids: ids });
      if (error) throw error;
      return data || [];
    },
    enabled: !!entregas?.length,
  });

  const profileMap = new Map((perfilesPublicos || []).map((p) => [p.id, p]));

  // Los archivos están en un bucket privado — para poder abrirlos hace falta
  // una URL firmada (con expiración), armada al vuelo para cada entrega.
  useEffect(() => {
    const fileEntregas = (entregas || []).filter((e: any) => e.tipo === "archivo" && !signedUrls[e.id]);
    if (fileEntregas.length === 0) return;
    (async () => {
      const results = await Promise.all(
        fileEntregas.map(async (e: any) => {
          const { data } = await supabase.storage.from("trabajos-finales").createSignedUrl(e.url, 3600);
          return [e.id, data?.signedUrl || ""] as const;
        }),
      );
      setSignedUrls((prev) => ({ ...prev, ...Object.fromEntries(results) }));
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entregas]);

  const approveMutation = useMutation({
    mutationFn: async (usuarioId: string) => {
      const { error } = await supabase.from("progreso_lecciones").upsert({
        usuario_id: usuarioId,
        leccion_id: lesson!.id,
        completado: true,
        completado_en: new Date().toISOString(),
      }, { onConflict: "usuario_id,leccion_id" });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["entregas-trabajo-final", lesson?.id] });
      toast.success("Trabajo final aprobado — la clase quedó completada para el alumno.");
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Trabajos finales — {lesson?.titulo}</DialogTitle>
          <DialogDescription>Revisá la entrega de cada alumno y aprobala para completarle la clase.</DialogDescription>
        </DialogHeader>

        <div className="space-y-3 pt-2">
          {isLoading ? (
            <p className="text-sm text-muted-foreground text-center py-8">Cargando entregas...</p>
          ) : entregas && entregas.length > 0 ? (
            entregas.map((entrega: any) => (
              <div key={entrega.id} className="flex items-center gap-4 p-4 rounded-xl border bg-card">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <User className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold truncate">{profileMap.get(entrega.usuario_id)?.nombre_completo || "Alumno"}</p>
                  <a
                    href={entrega.tipo === "link" ? entrega.url : (signedUrls[entrega.id] || "#")}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-primary hover:underline flex items-center gap-1 truncate"
                  >
                    {entrega.tipo === "link" ? <Link2 className="w-3 h-3 shrink-0" /> : <FileText className="w-3 h-3 shrink-0" />}
                    <span className="truncate">{entrega.tipo === "link" ? entrega.url : entrega.nombre_archivo}</span>
                  </a>
                </div>
                {entrega.aprobado ? (
                  <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 text-xs font-bold uppercase tracking-wide shrink-0">
                    <CheckCircle className="w-4 h-4" /> Aprobado
                  </div>
                ) : (
                  <Button
                    size="sm"
                    className="shrink-0 bg-emerald-600 hover:bg-emerald-700 text-white"
                    disabled={approveMutation.isPending}
                    onClick={() => approveMutation.mutate(entrega.usuario_id)}
                  >
                    <CheckCircle className="w-4 h-4 mr-1.5" /> Aprobar Trabajo Final
                  </Button>
                )}
              </div>
            ))
          ) : (
            <div className="text-center py-12 space-y-2">
              <Clock className="w-10 h-10 text-muted-foreground/40 mx-auto" />
              <p className="text-sm text-muted-foreground">Todavía no hay entregas de ningún alumno.</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default RevisarEntregasDialog;
