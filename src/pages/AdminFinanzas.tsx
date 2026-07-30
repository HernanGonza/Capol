import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Wallet, Megaphone, Server, Building2, GraduationCap, AlertTriangle, Settings, TrendingUp } from "lucide-react";
import { format, parseISO } from "date-fns";
import CurrencyConverter from "@/components/CurrencyConverter";

const fmt = (n: number) => `$${Math.round(n).toLocaleString("es-AR")}`;

type Pago = {
  id: string;
  usuario_id: string;
  curso_id: string;
  monto: number;
  costo_publicidad_ars: number;
  costo_plataforma_ars: number;
  pagado_en: string;
  perfiles: { nombre_completo: string | null } | null;
};

type Suscripcion = {
  id: string;
  usuario_id: string;
  curso_id: string;
  price: number;
  estado: string | null;
  fin_en: string | null;
  proxima_fecha_pago: string | null;
  perfiles: { nombre_completo: string | null } | null;
};

// Desglose de un pago según la fórmula: precio - publicidad - plataforma =
// resto, que se reparte 50/50 entre academia y profesor.
const desglosar = (monto: number, publicidad: number, plataforma: number) => {
  const resto = monto - publicidad - plataforma;
  return { publicidad, plataforma, resto, academia: resto / 2, profesor: resto / 2 };
};

const sumarDesgloses = (items: { monto: number; publicidad: number; plataforma: number }[]) =>
  items.reduce(
    (acc, it) => {
      const d = desglosar(it.monto, it.publicidad, it.plataforma);
      acc.recaudado += it.monto;
      acc.publicidad += d.publicidad;
      acc.plataforma += d.plataforma;
      acc.academia += d.academia;
      acc.profesor += d.profesor;
      return acc;
    },
    { recaudado: 0, publicidad: 0, plataforma: 0, academia: 0, profesor: 0 }
  );

const AdminFinanzas = () => {
  const queryClient = useQueryClient();
  const [cursoFiltro, setCursoFiltro] = useState("todos");
  const [mes, setMes] = useState(format(new Date(), "yyyy-MM"));
  const [configForm, setConfigForm] = useState<{ publicidad: string; plataforma: string; corte: string } | null>(null);

  const { data: config } = useQuery({
    queryKey: ["configuracion-financiera"],
    queryFn: async () => {
      const { data, error } = await supabase.from("configuracion_financiera").select("*").single();
      if (error) throw error;
      return data;
    },
  });

  const { data: cursos } = useQuery({
    queryKey: ["admin-courses-list"],
    queryFn: async () => {
      const { data } = await supabase.from("cursos").select("id, titulo").order("titulo");
      return data || [];
    },
  });

  // Profesor(es) asignado(s) a cada curso (admin bypasea la RLS de perfiles, así que este join funciona directo)
  const { data: docentesCursos } = useQuery({
    queryKey: ["docentes-cursos-finanzas"],
    queryFn: async () => {
      const { data, error } = await supabase.from("docentes_cursos").select("curso_id, perfiles:docente_id(nombre_completo)");
      if (error) throw error;
      return data || [];
    },
  });

  const { data: pagos } = useQuery({
    queryKey: ["pagos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pagos")
        .select("*, perfiles:usuario_id(nombre_completo)")
        .order("pagado_en", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as Pago[];
    },
  });

  // Alumnos con la suscripción vencida a ese curso: dinero que se esperaba y todavía no entró
  const { data: pendientes } = useQuery({
    queryKey: ["suscripciones-vencidas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("suscripciones")
        .select("*, perfiles:usuario_id(nombre_completo)")
        .eq("estado", "expired");
      if (error) throw error;
      return (data || []) as unknown as Suscripcion[];
    },
  });

  const configMutation = useMutation({
    mutationFn: async () => {
      if (!configForm) return;
      const { error } = await supabase
        .from("configuracion_financiera")
        .update({
          costo_publicidad_ars: parseFloat(configForm.publicidad) || 0,
          costo_plataforma_ars: parseFloat(configForm.plataforma) || 0,
          dia_corte: parseInt(configForm.corte) || 25,
        })
        .eq("id", true);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Configuración financiera actualizada");
      queryClient.invalidateQueries({ queryKey: ["configuracion-financiera"] });
      setConfigForm(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const diaCorte = config?.dia_corte ?? 25;

  // Período seleccionado: del corte del mes anterior (exclusivo) al corte del mes elegido (inclusivo).
  const periodo = useMemo(() => {
    const [y, m] = mes.split("-").map(Number);
    const end = new Date(y, m - 1, diaCorte, 23, 59, 59, 999);
    const start = new Date(y, m - 2, diaCorte, 0, 0, 0, 0);
    return { start, end };
  }, [mes, diaCorte]);

  const pagosPeriodo = useMemo(() => {
    if (!pagos) return [];
    return pagos.filter((p) => {
      const fecha = parseISO(p.pagado_en);
      return fecha > periodo.start && fecha <= periodo.end && (cursoFiltro === "todos" || p.curso_id === cursoFiltro);
    });
  }, [pagos, periodo, cursoFiltro]);

  const pagosFiltrados = useMemo(
    () => (pagos || []).filter((p) => cursoFiltro === "todos" || p.curso_id === cursoFiltro),
    [pagos, cursoFiltro]
  );

  const pendientesFiltrados = useMemo(
    () => (pendientes || []).filter((s) => cursoFiltro === "todos" || s.curso_id === cursoFiltro),
    [pendientes, cursoFiltro]
  );

  const pendientePeriodo = useMemo(
    () =>
      pendientesFiltrados.filter((s) => {
        const vencimiento = s.fin_en || s.proxima_fecha_pago;
        if (!vencimiento) return false;
        const fecha = parseISO(vencimiento);
        return fecha > periodo.start && fecha <= periodo.end;
      }),
    [pendientesFiltrados, periodo]
  );

  const resumenPeriodo = useMemo(
    () =>
      sumarDesgloses(
        pagosPeriodo.map((p) => ({ monto: p.monto, publicidad: p.costo_publicidad_ars, plataforma: p.costo_plataforma_ars }))
      ),
    [pagosPeriodo]
  );

  const resumenTotal = useMemo(
    () =>
      sumarDesgloses(
        pagosFiltrados.map((p) => ({ monto: p.monto, publicidad: p.costo_publicidad_ars, plataforma: p.costo_plataforma_ars }))
      ),
    [pagosFiltrados]
  );

  const pendienteMontoPeriodo = pendientePeriodo.reduce((acc, s) => acc + (s.price || 0), 0);
  const pendienteMontoTotal = pendientesFiltrados.reduce((acc, s) => acc + (s.price || 0), 0);

  // Desglose por curso (para la vista "Todos")
  const porCurso = useMemo(() => {
    if (!cursos) return [];
    return cursos.map((c) => {
      const propios = (pagos || []).filter((p) => p.curso_id === c.id);
      const propiosPeriodo = propios.filter((p) => {
        const fecha = parseISO(p.pagado_en);
        return fecha > periodo.start && fecha <= periodo.end;
      });
      const propiosPendientes = (pendientes || []).filter((s) => s.curso_id === c.id);
      const profesores = (docentesCursos || [])
        .filter((dc) => dc.curso_id === c.id)
        .map((dc: any) => dc.perfiles?.nombre_completo)
        .filter(Boolean);
      return {
        curso: c,
        profesores,
        periodo: sumarDesgloses(propiosPeriodo.map((p) => ({ monto: p.monto, publicidad: p.costo_publicidad_ars, plataforma: p.costo_plataforma_ars }))),
        total: sumarDesgloses(propios.map((p) => ({ monto: p.monto, publicidad: p.costo_publicidad_ars, plataforma: p.costo_plataforma_ars }))),
        pendienteMonto: propiosPendientes.reduce((acc, s) => acc + (s.price || 0), 0),
        pendienteCount: propiosPendientes.length,
      };
    });
  }, [cursos, pagos, pendientes, docentesCursos, periodo]);

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        <div>
          <h1 className="text-2xl font-bold">Panel Financiero</h1>
          <p className="text-muted-foreground">Reparto por alumno: precio - publicidad - plataforma = resto (50% academia / 50% profesor)</p>
        </div>

        <CurrencyConverter className="shadow-card" />

        {/* Configuración de la fórmula */}
        <Card className="shadow-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Settings className="w-4 h-4 text-primary" /> Configuración de costos fijos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
              <div className="space-y-2">
                <Label className="text-xs">Publicidad por alumno ($)</Label>
                <Input
                  type="number"
                  value={configForm?.publicidad ?? config?.costo_publicidad_ars ?? ""}
                  onChange={(e) =>
                    setConfigForm({
                      publicidad: e.target.value,
                      plataforma: configForm?.plataforma ?? String(config?.costo_plataforma_ars ?? ""),
                      corte: configForm?.corte ?? String(config?.dia_corte ?? 25),
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Plataforma por alumno ($)</Label>
                <Input
                  type="number"
                  value={configForm?.plataforma ?? config?.costo_plataforma_ars ?? ""}
                  onChange={(e) =>
                    setConfigForm({
                      publicidad: configForm?.publicidad ?? String(config?.costo_publicidad_ars ?? ""),
                      plataforma: e.target.value,
                      corte: configForm?.corte ?? String(config?.dia_corte ?? 25),
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Día de corte del mes</Label>
                <Input
                  type="number"
                  min={1}
                  max={28}
                  value={configForm?.corte ?? config?.dia_corte ?? ""}
                  onChange={(e) =>
                    setConfigForm({
                      publicidad: configForm?.publicidad ?? String(config?.costo_publicidad_ars ?? ""),
                      plataforma: configForm?.plataforma ?? String(config?.costo_plataforma_ars ?? ""),
                      corte: e.target.value,
                    })
                  }
                />
              </div>
              <Button
                className="gradient-primary text-primary-foreground"
                disabled={!configForm || configMutation.isPending}
                onClick={() => configMutation.mutate()}
              >
                Guardar
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Filtros */}
        <Card className="bg-muted/30 border-none shadow-none">
          <CardContent className="p-4 flex flex-col md:flex-row gap-4">
            <Select value={cursoFiltro} onValueChange={setCursoFiltro}>
              <SelectTrigger className="w-full md:w-[260px] bg-background">
                <SelectValue placeholder="Curso" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos los cursos</SelectItem>
                {cursos?.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.titulo}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input type="month" className="w-full md:w-[200px] bg-background" value={mes} onChange={(e) => setMes(e.target.value)} />
            <p className="text-xs text-muted-foreground self-center">
              Período: {format(periodo.start, "dd/MM/yyyy")} a {format(periodo.end, "dd/MM/yyyy")} (corte día {diaCorte})
            </p>
          </CardContent>
        </Card>

        {/* Resumen del período seleccionado */}
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground mb-3 flex items-center gap-2">
            <TrendingUp className="w-4 h-4" /> Este período
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <Card className="border-none shadow-card">
              <CardContent className="p-4">
                <Wallet className="w-4 h-4 text-primary mb-1" />
                <p className="text-lg font-bold">{fmt(resumenPeriodo.recaudado)}</p>
                <p className="text-[11px] text-muted-foreground">Recaudado</p>
              </CardContent>
            </Card>
            <Card className="border-none shadow-card">
              <CardContent className="p-4">
                <Megaphone className="w-4 h-4 text-orange-500 mb-1" />
                <p className="text-lg font-bold">{fmt(resumenPeriodo.publicidad)}</p>
                <p className="text-[11px] text-muted-foreground">Publicidad</p>
              </CardContent>
            </Card>
            <Card className="border-none shadow-card">
              <CardContent className="p-4">
                <Server className="w-4 h-4 text-indigo-500 mb-1" />
                <p className="text-lg font-bold">{fmt(resumenPeriodo.plataforma)}</p>
                <p className="text-[11px] text-muted-foreground">Plataforma</p>
              </CardContent>
            </Card>
            <Card className="border-none shadow-card">
              <CardContent className="p-4">
                <Building2 className="w-4 h-4 text-blue-500 mb-1" />
                <p className="text-lg font-bold">{fmt(resumenPeriodo.academia)}</p>
                <p className="text-[11px] text-muted-foreground">Academia</p>
              </CardContent>
            </Card>
            <Card className="border-none shadow-card">
              <CardContent className="p-4">
                <GraduationCap className="w-4 h-4 text-emerald-500 mb-1" />
                <p className="text-lg font-bold">{fmt(resumenPeriodo.profesor)}</p>
                <p className="text-[11px] text-muted-foreground">Profesor</p>
              </CardContent>
            </Card>
            <Card className="border-none shadow-card">
              <CardContent className="p-4">
                <AlertTriangle className="w-4 h-4 text-destructive mb-1" />
                <p className="text-lg font-bold">{fmt(pendienteMontoPeriodo)}</p>
                <p className="text-[11px] text-muted-foreground">Pendiente ({pendientePeriodo.length})</p>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Acumulado histórico */}
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground mb-3">Acumulado histórico</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <Card className="border-none shadow-card bg-muted/30">
              <CardContent className="p-4">
                <p className="text-lg font-bold">{fmt(resumenTotal.recaudado)}</p>
                <p className="text-[11px] text-muted-foreground">Recaudado</p>
              </CardContent>
            </Card>
            <Card className="border-none shadow-card bg-muted/30">
              <CardContent className="p-4">
                <p className="text-lg font-bold">{fmt(resumenTotal.publicidad)}</p>
                <p className="text-[11px] text-muted-foreground">Publicidad</p>
              </CardContent>
            </Card>
            <Card className="border-none shadow-card bg-muted/30">
              <CardContent className="p-4">
                <p className="text-lg font-bold">{fmt(resumenTotal.plataforma)}</p>
                <p className="text-[11px] text-muted-foreground">Plataforma</p>
              </CardContent>
            </Card>
            <Card className="border-none shadow-card bg-muted/30">
              <CardContent className="p-4">
                <p className="text-lg font-bold">{fmt(resumenTotal.academia)}</p>
                <p className="text-[11px] text-muted-foreground">Academia</p>
              </CardContent>
            </Card>
            <Card className="border-none shadow-card bg-muted/30">
              <CardContent className="p-4">
                <p className="text-lg font-bold">{fmt(resumenTotal.profesor)}</p>
                <p className="text-[11px] text-muted-foreground">Profesor</p>
              </CardContent>
            </Card>
            <Card className="border-none shadow-card bg-muted/30">
              <CardContent className="p-4">
                <p className="text-lg font-bold">{fmt(pendienteMontoTotal)}</p>
                <p className="text-[11px] text-muted-foreground">Pendiente ({pendientesFiltrados.length})</p>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Desglose por curso (solo cuando se ven "Todos") */}
        {cursoFiltro === "todos" && (
          <Card className="shadow-card overflow-hidden">
            <CardHeader className="bg-muted/30 border-b">
              <CardTitle className="text-base">Desglose por curso — este período</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y">
                {porCurso.map((c) => (
                  <div key={c.curso.id} className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-bold">{c.curso.titulo}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {c.profesores.length ? c.profesores.join(", ") : "Sin profesor asignado"}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-4 text-sm shrink-0">
                      <div className="text-right">
                        <p className="font-bold">{fmt(c.periodo.recaudado)}</p>
                        <p className="text-[10px] text-muted-foreground uppercase">Recaudado</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-indigo-600 dark:text-indigo-400">{fmt(c.periodo.plataforma)}</p>
                        <p className="text-[10px] text-muted-foreground uppercase">Plataforma</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-blue-600 dark:text-blue-400">{fmt(c.periodo.academia)}</p>
                        <p className="text-[10px] text-muted-foreground uppercase">Academia</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-emerald-600 dark:text-emerald-400">{fmt(c.periodo.profesor)}</p>
                        <p className="text-[10px] text-muted-foreground uppercase">Profesor</p>
                      </div>
                      {c.pendienteCount > 0 && (
                        <Badge variant="outline" className="bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-400 border-red-200 dark:border-red-900">
                          {c.pendienteCount} pendiente{c.pendienteCount > 1 ? "s" : ""} · {fmt(c.pendienteMonto)}
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
                {porCurso.length === 0 && (
                  <p className="text-center text-sm text-muted-foreground py-10">Todavía no hay cursos cargados.</p>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Detalle de pagos del período (cuando se filtra un curso puntual) */}
        {cursoFiltro !== "todos" && (
          <>
            <Card className="shadow-card overflow-hidden">
              <CardHeader className="bg-muted/30 border-b">
                <CardTitle className="text-base">Pagos de este período ({pagosPeriodo.length})</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y">
                  {pagosPeriodo.map((p) => {
                    const d = desglosar(p.monto, p.costo_publicidad_ars, p.costo_plataforma_ars);
                    return (
                      <div key={p.id} className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-2">
                        <div>
                          <p className="font-bold">{p.perfiles?.nombre_completo || "Alumno"}</p>
                          <p className="text-xs text-muted-foreground">{format(parseISO(p.pagado_en), "dd/MM/yyyy")}</p>
                        </div>
                        <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                          <span>Pagó: <strong className="text-foreground">{fmt(p.monto)}</strong></span>
                          <span>Academia: <strong className="text-foreground">{fmt(d.academia)}</strong></span>
                          <span>Profesor: <strong className="text-foreground">{fmt(d.profesor)}</strong></span>
                        </div>
                      </div>
                    );
                  })}
                  {pagosPeriodo.length === 0 && (
                    <p className="text-center text-sm text-muted-foreground py-10">Sin pagos registrados en este período.</p>
                  )}
                </div>
              </CardContent>
            </Card>

            {pendientesFiltrados.length > 0 && (
              <Card className="shadow-card overflow-hidden border-destructive/30">
                <CardHeader className="bg-red-50 dark:bg-red-950/20 border-b border-destructive/20">
                  <CardTitle className="text-base flex items-center gap-2 text-destructive">
                    <AlertTriangle className="w-4 h-4" /> Alumnos con pago pendiente ({pendientesFiltrados.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="divide-y">
                    {pendientesFiltrados.map((s) => (
                      <div key={s.id} className="p-4 flex items-center justify-between gap-3">
                        <p className="font-medium">{s.perfiles?.nombre_completo || "Alumno"}</p>
                        <span className="text-sm font-bold">{fmt(s.price || 0)}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </AppLayout>
  );
};

export default AdminFinanzas;
