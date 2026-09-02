import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { GraduationCap } from "lucide-react";
import ModalidadBadge from "@/components/ModalidadBadge";
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
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 text-center">
              <div className="rounded-xl bg-muted/50 p-3">
                <p className="text-2xl font-bold">{resumen.totalConCurso}</p>
                <p className="text-[11px] text-muted-foreground">Alumnos con curso</p>
              </div>
              <div className="rounded-xl bg-amber-50 dark:bg-amber-950/30 p-3">
                <p className="text-2xl font-bold text-amber-700 dark:text-amber-300">
                  {resumen.porEmpezar}
                </p>
                <p className="text-[11px] text-muted-foreground">Por empezar</p>
              </div>
              <div className="rounded-xl bg-indigo-50 dark:bg-indigo-950/30 p-3">
                <p className="text-2xl font-bold text-indigo-700 dark:text-indigo-300">
                  {resumen.cursando}
                </p>
                <p className="text-[11px] text-muted-foreground">Cursando (en vivo)</p>
              </div>
              <div className="rounded-xl bg-sky-50 dark:bg-sky-950/30 p-3">
                <p className="text-2xl font-bold text-sky-700 dark:text-sky-300">
                  {resumen.enProgreso}
                </p>
                <p className="text-[11px] text-muted-foreground">Grabados</p>
              </div>
              <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/30 p-3">
                <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">
                  {resumen.graduados}
                </p>
                <p className="text-[11px] text-muted-foreground">Graduados</p>
              </div>
            </div>

            {resumen.porCurso.length ? (
              <div className="space-y-1.5 overflow-x-auto">
                <div className="grid grid-cols-[minmax(9rem,1fr)_4.75rem_4.75rem_4.75rem_4.75rem] gap-x-2 text-[10px] font-bold uppercase tracking-wide text-muted-foreground pb-1 border-b min-w-[26rem]">
                  <span>Curso</span>
                  <span className="text-center whitespace-nowrap">Por empezar</span>
                  <span className="text-center whitespace-nowrap">Cursando</span>
                  <span className="text-center whitespace-nowrap">Grabados</span>
                  <span className="text-center whitespace-nowrap">Graduados</span>
                </div>
                {resumen.porCurso.map((c) => (
                  <div
                    key={c.cursoId}
                    className="grid grid-cols-[minmax(9rem,1fr)_4.75rem_4.75rem_4.75rem_4.75rem] gap-x-2 text-sm items-center min-w-[26rem]"
                  >
                    <span className="truncate flex items-center gap-1.5">
                      <span className="truncate">{c.titulo}</span>
                      <ModalidadBadge modalidad={c.modalidad} showIcon={false} className="shrink-0" />
                      {!c.enMarcha && (
                        <span className="shrink-0 text-[10px] text-amber-600 dark:text-amber-400">
                          no empezó
                        </span>
                      )}
                    </span>
                    <span className="text-center font-semibold text-amber-700 dark:text-amber-300">
                      {c.porEmpezar || "—"}
                    </span>
                    <span className="text-center font-semibold text-indigo-700 dark:text-indigo-300">
                      {c.modalidad === "grabado" ? "—" : c.actuales}
                    </span>
                    <span className="text-center font-semibold text-sky-700 dark:text-sky-300">
                      {c.modalidad === "grabado" ? c.enProgreso : "—"}
                    </span>
                    <span className="text-center font-semibold text-emerald-700 dark:text-emerald-300">
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
              "Cursando" = cursos en vivo ya en marcha (según su fecha de inicio).
              "Grabados" = alumnos de un curso grabado que todavía no lo terminaron.
              "Por empezar" = inscriptos a un curso en vivo que todavía no arrancó.
              Los recuadros de arriba cuentan personas distintas.
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default AlumnosPorCursoCard;
