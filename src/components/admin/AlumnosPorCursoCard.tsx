import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { GraduationCap } from "lucide-react";
import {
  resumirProgresoAlumnos,
  type ProgresoAlumnoCurso,
} from "@/lib/studentStats";

// Tabla "alumnos por curso" separando los que están cursando de los graduados
// (todas las clases completadas). Se usa igual en el Panel de Control y en
// Métricas. Trae su propia data de la RPC progreso_alumnos_cursos (solo admin).
const AlumnosPorCursoCard = ({ className }: { className?: string }) => {
  const { data, isLoading } = useQuery({
    queryKey: ["progreso-alumnos-cursos"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("progreso_alumnos_cursos");
      if (error) throw error;
      return (data || []) as ProgresoAlumnoCurso[];
    },
  });

  const resumen = resumirProgresoAlumnos(data);

  return (
    <Card className={`border-none shadow-card ${className || ""}`}>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <GraduationCap className="w-5 h-5 text-indigo-500" /> Alumnos por curso
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <p className="text-sm text-muted-foreground animate-pulse">Cargando…</p>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-xl bg-muted/50 p-3">
                <p className="text-2xl font-bold">{resumen.totalConCurso}</p>
                <p className="text-[11px] text-muted-foreground">Alumnos con curso</p>
              </div>
              <div className="rounded-xl bg-indigo-50 dark:bg-indigo-950/30 p-3">
                <p className="text-2xl font-bold text-indigo-700 dark:text-indigo-300">
                  {resumen.cursando}
                </p>
                <p className="text-[11px] text-muted-foreground">Cursando</p>
              </div>
              <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/30 p-3">
                <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">
                  {resumen.graduados}
                </p>
                <p className="text-[11px] text-muted-foreground">Graduados</p>
              </div>
            </div>

            {resumen.porCurso.length ? (
              <div className="space-y-1.5">
                <div className="grid grid-cols-[1fr_auto_auto] gap-x-4 text-[11px] font-bold uppercase tracking-wider text-muted-foreground pb-1 border-b">
                  <span>Curso</span>
                  <span className="text-right w-16">Cursando</span>
                  <span className="text-right w-16">Graduados</span>
                </div>
                {resumen.porCurso.map((c) => (
                  <div
                    key={c.cursoId}
                    className="grid grid-cols-[1fr_auto_auto] gap-x-4 text-sm items-center"
                  >
                    <span className="truncate">
                      {c.titulo}
                      <span className="ml-1.5 text-[10px] text-muted-foreground">
                        {c.modalidad === "grabado" ? "grabado" : "en vivo"}
                      </span>
                    </span>
                    <span className="text-right w-16 font-semibold text-indigo-700 dark:text-indigo-300">
                      {c.actuales}
                    </span>
                    <span className="text-right w-16 font-semibold text-emerald-700 dark:text-emerald-300">
                      {c.graduados}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                Todavía no hay alumnos inscriptos a un curso.
              </p>
            )}

            <p className="text-[11px] text-muted-foreground/80 pt-1.5 border-t border-border/50">
              "Graduado" = completó todas las clases del curso. Un alumno con
              varios cursos cuenta como graduado solo cuando terminó todos.
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default AlumnosPorCursoCard;
