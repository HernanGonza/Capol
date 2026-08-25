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
import { Wallet, Megaphone, Server, Building2, GraduationCap, AlertTriangle, Settings, TrendingUp, CheckCircle2, Receipt } from "lucide-react";
import { addMonths, differenceInCalendarMonths, format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import CurrencyConverter from "@/components/CurrencyConverter";
import { ARS_FIXED_RATE } from "@/lib/currency";

const fmt = (n: number) => `$${Math.round(n).toLocaleString("es-AR")}`;

type Pago = {
  id: string;
  usuario_id: string;
  curso_id: string;
  suscripcion_id: string | null;
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
  creado_en: string | null;
  perfiles: { nombre_completo: string | null } | null;
  cursos: {
    fecha_inicio: string | null;
    precio: number | null;
    cotizacion_ars: number | null;
  } | null;
};

const montoPendienteArs = (suscripcion: Suscripcion) => {
  const precioUsd = Number(suscripcion.cursos?.precio);
  if (!Number.isFinite(precioUsd) || precioUsd <= 0) return 0;
  const cotizacion = Number(suscripcion.cursos?.cotizacion_ars) || ARS_FIXED_RATE;
  return Math.round(precioUsd * cotizacion * 100) / 100;
};

const fechaPendiente = (suscripcion: Suscripcion, pagos: Pago[]) => {
  const fechaGuardada = suscripcion.proxima_fecha_pago || suscripcion.fin_en;
  if (fechaGuardada) return parseISO(fechaGuardada);

  const inicioCurso = suscripcion.cursos?.fecha_inicio;
  if (!inicioCurso) return null;

  const inicio = parseISO(inicioCurso);
  const tuvoPagos = pagos.some(
    (p) =>
      p.suscripcion_id === suscripcion.id ||
      (p.usuario_id === suscripcion.usuario_id && p.curso_id === suscripcion.curso_id)
  );

  if (!tuvoPagos || inicio > new Date()) return inicio;

  const meses = Math.max(0, differenceInCalendarMonths(new Date(), inicio));
  const candidato = addMonths(inicio, meses);
  return candidato > new Date() ? addMonths(candidato, -1) : candidato;
};

// Desglose de un pago. Para cursos en_vivo la fórmula es la de siempre:
// precio - publicidad - plataforma = resto, que se reparte 50/50 entre
// academia y profesor. Para cursos grabados no hay profesor ni publicidad
// que pagar (es contenido ya grabado, sin costo recurrente de dictado) —
// solo se le paga la plataforma, y el resto queda entero para la academia.
const desglosar = (monto: number, publicidad: number, plataforma: number, modalidad: "en_vivo" | "grabado" = "en_vivo") => {
  if (modalidad === "grabado") {
    const resto = monto - plataforma;
    return { publicidad: 0, plataforma, resto, academia: resto, profesor: 0 };
  }
  const resto = monto - publicidad - plataforma;
  return { publicidad, plataforma, resto, academia: resto / 2, profesor: resto / 2 };
};

const sumarDesgloses = (items: { monto: number; publicidad: number; plataforma: number; modalidad?: "en_vivo" | "grabado" }[]) =>
  items.reduce(
    (acc, it) => {
      const d = desglosar(it.monto, it.publicidad, it.plataforma, it.modalidad);
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
  const [tabModalidad, setTabModalidad] = useState<"en_vivo" | "grabado">("en_vivo");
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
    queryKey: ["admin-courses-list-modalidad"],
    queryFn: async () => {
      const { data } = await supabase.from("cursos").select("id, titulo, modalidad, fecha_inicio, precio, cotizacion_ars").order("titulo");
      return data || [];
    },
  });

  const modalidadPorCurso = useMemo(
    () => new Map((cursos || []).map((c) => [c.id, c.modalidad as "en_vivo" | "grabado"])),
    [cursos]
  );

  const cursosTab = useMemo(
    () => (cursos || []).filter((c) => (c.modalidad || "en_vivo") === tabModalidad),
    [cursos, tabModalidad]
  );

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

  // Suscripciones que todavía deben su primer pago o una mensualidad.
  const { data: pendientes } = useQuery({
    queryKey: ["suscripciones-pago-pendiente"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("suscripciones")
        .select("*, perfiles:usuario_id(nombre_completo), cursos:curso_id(fecha_inicio, precio, cotizacion_ars)")
        .eq("estado", "pago_pendiente");
      if (error) throw error;
      return (data || []) as unknown as Suscripcion[];
    },
  });

  // Pagos ya liquidados a cada curso (profesor + plataforma) por período —
  // a diferencia del resto de las métricas de acá (que son todas calculadas
  // en caliente), esto SÍ queda como un registro persistente y es POR
  // CURSO: saber si a "n8n" ya se le pagó el período de julio es
  // independiente de si se pagó cualquier otro curso ese mismo mes.
  const { data: cortesPlataforma } = useQuery({
    queryKey: ["cortes-plataforma"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cortes_plataforma")
        .select("*")
        .order("periodo_mes", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const corteKey = (cursoId: string, periodoMes: string) => `${cursoId}::${periodoMes}`;
  const cortesPorCursoYPeriodo = useMemo(
    () => new Map((cortesPlataforma || []).map((c) => [corteKey(c.curso_id, c.periodo_mes), c])),
    [cortesPlataforma]
  );

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

  const marcarCortePagadoMutation = useMutation({
    mutationFn: async ({
      cursoId,
      periodoMes,
      periodoInicio,
      periodoFin,
      montoPlataforma,
      montoProfesor,
    }: {
      cursoId: string;
      periodoMes: string;
      periodoInicio: Date;
      periodoFin: Date;
      montoPlataforma: number;
      montoProfesor: number;
    }) => {
      const { error } = await supabase.from("cortes_plataforma").insert({
        curso_id: cursoId,
        periodo_mes: periodoMes,
        periodo_inicio: format(periodoInicio, "yyyy-MM-dd"),
        periodo_fin: format(periodoFin, "yyyy-MM-dd"),
        monto_plataforma: montoPlataforma,
        monto_profesor: montoProfesor,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cortes-plataforma"] });
      toast.success("Pago registrado como liquidado");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const diaCorte = config?.dia_corte ?? 25;

  // Período seleccionado: desde el día posterior al corte anterior hasta el
  // cierre del día de corte elegido. Ningún instante pertenece a dos períodos.
  const periodo = useMemo(() => {
    const [y, m] = mes.split("-").map(Number);
    const end = new Date(y, m - 1, diaCorte, 23, 59, 59, 999);
    const start = new Date(y, m - 2, diaCorte + 1, 0, 0, 0, 0);
    return { start, end };
  }, [mes, diaCorte]);

  // Todos los filtros de pagos/pendientes respetan la pestaña de modalidad
  // (en_vivo/grabado) además del curso puntual elegido — un curso grabado
  // nunca se mezcla con el reporte de en vivo, ni al revés.
  const esDeLaTab = (cursoId: string) => (modalidadPorCurso.get(cursoId) || "en_vivo") === tabModalidad;

  const pagosPeriodo = useMemo(() => {
    if (!pagos) return [];
    return pagos.filter((p) => {
      const fecha = parseISO(p.pagado_en);
      return fecha >= periodo.start && fecha <= periodo.end && (cursoFiltro === "todos" || p.curso_id === cursoFiltro) && esDeLaTab(p.curso_id);
    });
  }, [pagos, periodo, cursoFiltro, tabModalidad, modalidadPorCurso]);

  const pagosFiltrados = useMemo(
    () => (pagos || []).filter((p) => (cursoFiltro === "todos" || p.curso_id === cursoFiltro) && esDeLaTab(p.curso_id)),
    [pagos, cursoFiltro, tabModalidad, modalidadPorCurso]
  );

  const pendientesFiltrados = useMemo(
    () => (pendientes || []).filter((s) => (cursoFiltro === "todos" || s.curso_id === cursoFiltro) && esDeLaTab(s.curso_id)),
    [pendientes, cursoFiltro, tabModalidad, modalidadPorCurso]
  );

  const pendientePeriodo = useMemo(
    () =>
      pendientesFiltrados.filter((s) => {
        const fecha = fechaPendiente(s, pagos || []);
        return fecha != null && fecha >= periodo.start && fecha <= periodo.end;
      }),
    [pendientesFiltrados, periodo, pagos]
  );

  const resumenPeriodo = useMemo(
    () =>
      sumarDesgloses(
        pagosPeriodo.map((p) => ({ monto: p.monto, publicidad: p.costo_publicidad_ars, plataforma: p.costo_plataforma_ars, modalidad: tabModalidad }))
      ),
    [pagosPeriodo, tabModalidad]
  );

  const resumenTotal = useMemo(
    () =>
      sumarDesgloses(
        pagosFiltrados.map((p) => ({ monto: p.monto, publicidad: p.costo_publicidad_ars, plataforma: p.costo_plataforma_ars, modalidad: tabModalidad }))
      ),
    [pagosFiltrados, tabModalidad]
  );

  const pendienteMontoPeriodo = pendientePeriodo.reduce((acc, s) => acc + montoPendienteArs(s), 0);
  const pendienteMontoTotal = pendientesFiltrados.reduce((acc, s) => acc + montoPendienteArs(s), 0);

  // Desglose por curso (para la vista "Todos"), solo de la modalidad activa
  const porCurso = useMemo(() => {
    if (!cursosTab) return [];
    return cursosTab.map((c) => {
      const propios = (pagos || []).filter((p) => p.curso_id === c.id);
      const propiosPeriodo = propios.filter((p) => {
        const fecha = parseISO(p.pagado_en);
        return fecha >= periodo.start && fecha <= periodo.end;
      });
      const propiosPendientes = pendientePeriodo.filter((s) => s.curso_id === c.id);
      const profesores = (docentesCursos || [])
        .filter((dc) => dc.curso_id === c.id)
        .map((dc: any) => dc.perfiles?.nombre_completo)
        .filter(Boolean);
      return {
        curso: c,
        profesores,
        periodo: sumarDesgloses(propiosPeriodo.map((p) => ({ monto: p.monto, publicidad: p.costo_publicidad_ars, plataforma: p.costo_plataforma_ars, modalidad: tabModalidad }))),
        total: sumarDesgloses(propios.map((p) => ({ monto: p.monto, publicidad: p.costo_publicidad_ars, plataforma: p.costo_plataforma_ars, modalidad: tabModalidad }))),
        pendienteMonto: propiosPendientes.reduce((acc, s) => acc + montoPendienteArs(s), 0),
        pendienteCount: propiosPendientes.length,
        // Si a este curso ya se le liquidó (profesor + plataforma) el
        // período que se está mirando ahora mismo.
        corte: cortesPorCursoYPeriodo.get(corteKey(c.id, mes)),
      };
    });
  }, [cursosTab, pagos, pendientePeriodo, docentesCursos, periodo, tabModalidad, cortesPorCursoYPeriodo, mes]);

  // Cursos de la pestaña activa con plata para liquidar este período que
  // todavía no se marcaron como pagados — el "cuadro" de pendientes.
  const pendientesDeLiquidar = useMemo(
    () => porCurso.filter((c) => c.periodo.recaudado > 0 && !c.corte),
    [porCurso]
  );

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        <div>
          <h1 className="text-2xl font-bold">Panel Financiero</h1>
          <p className="text-muted-foreground">
            {tabModalidad === "en_vivo"
              ? "Reparto por alumno: precio - publicidad - plataforma = resto (50% academia / 50% profesor)"
              : "Los cursos grabados no tienen profesor ni publicidad recurrente: precio - plataforma = academia"}
          </p>
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

        {/* Pagos pendientes a profesores y plataforma — este período, de la
            pestaña activa. Cada curso se liquida (profesor + plataforma)
            por separado, así que esto lista solo los que todavía no se
            marcaron como pagados. */}
        {pendientesDeLiquidar.length > 0 && (
          <Card className="shadow-card overflow-hidden border-amber-300 dark:border-amber-800">
            <CardHeader className="bg-amber-50 dark:bg-amber-950/20 border-b border-amber-200 dark:border-amber-900">
              <CardTitle className="text-base flex items-center gap-2 text-amber-700 dark:text-amber-400">
                <Receipt className="w-4 h-4" /> Pendientes de liquidar — {format(periodo.end, "MMMM yyyy", { locale: es })} ({pendientesDeLiquidar.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y">
                {pendientesDeLiquidar.map((c) => (
                  <div key={c.curso.id} className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-bold">{c.curso.titulo}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {c.profesores.length ? c.profesores.join(", ") : "Sin profesor asignado"}
                      </p>
                    </div>
                    <div className="flex items-center gap-4 shrink-0">
                      <div className="text-right text-sm">
                        <p className="font-bold text-indigo-600 dark:text-indigo-400">{fmt(c.periodo.plataforma)} plataforma</p>
                        {tabModalidad === "en_vivo" && (
                          <p className="font-bold text-emerald-600 dark:text-emerald-400">{fmt(c.periodo.profesor)} profesor</p>
                        )}
                      </div>
                      <Button
                        size="sm"
                        className="gradient-primary text-primary-foreground"
                        disabled={marcarCortePagadoMutation.isPending}
                        onClick={() =>
                          marcarCortePagadoMutation.mutate({
                            cursoId: c.curso.id,
                            periodoMes: mes,
                            periodoInicio: periodo.start,
                            periodoFin: periodo.end,
                            montoPlataforma: c.periodo.plataforma,
                            montoProfesor: c.periodo.profesor,
                          })
                        }
                      >
                        Marcar pagado
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Tabs En vivo / Grabados — los grabados no le pagan nada al
            profesor ni a publicidad, así que conviene no mezclar el reporte. */}
        <div className="flex gap-2 border-b">
          <button
            type="button"
            onClick={() => { setTabModalidad("en_vivo"); setCursoFiltro("todos"); }}
            className={`px-4 py-2 text-sm font-semibold border-b-2 transition-colors ${
              tabModalidad === "en_vivo" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            En vivo
          </button>
          <button
            type="button"
            onClick={() => { setTabModalidad("grabado"); setCursoFiltro("todos"); }}
            className={`px-4 py-2 text-sm font-semibold border-b-2 transition-colors ${
              tabModalidad === "grabado" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            Grabados
          </button>
        </div>

        {/* Filtros */}
        <Card className="bg-muted/30 border-none shadow-none">
          <CardContent className="p-4 flex flex-col md:flex-row gap-4">
            <Select value={cursoFiltro} onValueChange={setCursoFiltro}>
              <SelectTrigger className="w-full md:w-[260px] bg-background">
                <SelectValue placeholder="Curso" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos los cursos</SelectItem>
                {cursosTab?.map((c) => (
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
          <div className={`grid grid-cols-2 md:grid-cols-3 gap-3 ${tabModalidad === "en_vivo" ? "lg:grid-cols-6" : "lg:grid-cols-4"}`}>
            <Card className="border-none shadow-card">
              <CardContent className="p-4">
                <Wallet className="w-4 h-4 text-primary mb-1" />
                <p className="text-lg font-bold">{fmt(resumenPeriodo.recaudado)}</p>
                <p className="text-[11px] text-muted-foreground">Recaudado</p>
              </CardContent>
            </Card>
            {tabModalidad === "en_vivo" && (
              <Card className="border-none shadow-card">
                <CardContent className="p-4">
                  <Megaphone className="w-4 h-4 text-orange-500 mb-1" />
                  <p className="text-lg font-bold">{fmt(resumenPeriodo.publicidad)}</p>
                  <p className="text-[11px] text-muted-foreground">Publicidad</p>
                </CardContent>
              </Card>
            )}
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
            {tabModalidad === "en_vivo" && (
              <Card className="border-none shadow-card">
                <CardContent className="p-4">
                  <GraduationCap className="w-4 h-4 text-emerald-500 mb-1" />
                  <p className="text-lg font-bold">{fmt(resumenPeriodo.profesor)}</p>
                  <p className="text-[11px] text-muted-foreground">Profesor</p>
                </CardContent>
              </Card>
            )}
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
          <div className={`grid grid-cols-2 md:grid-cols-3 gap-3 ${tabModalidad === "en_vivo" ? "lg:grid-cols-6" : "lg:grid-cols-4"}`}>
            <Card className="border-none shadow-card bg-muted/30">
              <CardContent className="p-4">
                <p className="text-lg font-bold">{fmt(resumenTotal.recaudado)}</p>
                <p className="text-[11px] text-muted-foreground">Recaudado</p>
              </CardContent>
            </Card>
            {tabModalidad === "en_vivo" && (
              <Card className="border-none shadow-card bg-muted/30">
                <CardContent className="p-4">
                  <p className="text-lg font-bold">{fmt(resumenTotal.publicidad)}</p>
                  <p className="text-[11px] text-muted-foreground">Publicidad</p>
                </CardContent>
              </Card>
            )}
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
            {tabModalidad === "en_vivo" && (
              <Card className="border-none shadow-card bg-muted/30">
                <CardContent className="p-4">
                  <p className="text-lg font-bold">{fmt(resumenTotal.profesor)}</p>
                  <p className="text-[11px] text-muted-foreground">Profesor</p>
                </CardContent>
              </Card>
            )}
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
                      {tabModalidad === "en_vivo" && (
                        <div className="text-right">
                          <p className="font-bold text-emerald-600 dark:text-emerald-400">{fmt(c.periodo.profesor)}</p>
                          <p className="text-[10px] text-muted-foreground uppercase">Profesor</p>
                        </div>
                      )}
                      {c.pendienteCount > 0 && (
                        <Badge variant="outline" className="bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-400 border-red-200 dark:border-red-900">
                          {c.pendienteCount} pendiente{c.pendienteCount > 1 ? "s" : ""} · {fmt(c.pendienteMonto)}
                        </Badge>
                      )}
                      {c.corte ? (
                        <Badge variant="outline" className="bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900">
                          <CheckCircle2 className="w-3 h-3 mr-1" /> Pagado el {format(parseISO(c.corte.pagado_en), "dd/MM/yyyy")}
                        </Badge>
                      ) : c.periodo.recaudado > 0 ? (
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-800 hover:bg-amber-50 dark:hover:bg-amber-950/40"
                          disabled={marcarCortePagadoMutation.isPending}
                          onClick={() =>
                            marcarCortePagadoMutation.mutate({
                              cursoId: c.curso.id,
                              periodoMes: mes,
                              periodoInicio: periodo.start,
                              periodoFin: periodo.end,
                              montoPlataforma: c.periodo.plataforma,
                              montoProfesor: c.periodo.profesor,
                            })
                          }
                        >
                          Marcar pagado
                        </Button>
                      ) : null}
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
            {(() => {
              const c = porCurso.find((pc) => pc.curso.id === cursoFiltro);
              if (!c) return null;
              return (
                <Card className={`shadow-card ${c.corte ? "border-emerald-200 dark:border-emerald-900" : "border-amber-300 dark:border-amber-800"}`}>
                  <CardContent className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
                    <div>
                      <p className="font-bold">{c.curso.titulo} — {format(periodo.end, "MMMM yyyy", { locale: es })}</p>
                      <p className="text-sm text-muted-foreground">
                        {fmt(c.periodo.plataforma)} plataforma{tabModalidad === "en_vivo" ? ` + ${fmt(c.periodo.profesor)} profesor` : ""}
                      </p>
                    </div>
                    {c.corte ? (
                      <Badge variant="outline" className="bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900 w-fit">
                        <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Pagado el {format(parseISO(c.corte.pagado_en), "dd/MM/yyyy")}
                      </Badge>
                    ) : (
                      <Button
                        className="gradient-primary text-primary-foreground w-fit"
                        disabled={marcarCortePagadoMutation.isPending || c.periodo.recaudado === 0}
                        onClick={() =>
                          marcarCortePagadoMutation.mutate({
                            cursoId: c.curso.id,
                            periodoMes: mes,
                            periodoInicio: periodo.start,
                            periodoFin: periodo.end,
                            montoPlataforma: c.periodo.plataforma,
                            montoProfesor: c.periodo.profesor,
                          })
                        }
                      >
                        Marcar pagado
                      </Button>
                    )}
                  </CardContent>
                </Card>
              );
            })()}

            <Card className="shadow-card overflow-hidden">
              <CardHeader className="bg-muted/30 border-b">
                <CardTitle className="text-base">Pagos de este período ({pagosPeriodo.length})</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y">
                  {pagosPeriodo.map((p) => {
                    const d = desglosar(p.monto, p.costo_publicidad_ars, p.costo_plataforma_ars, tabModalidad);
                    return (
                      <div key={p.id} className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-2">
                        <div>
                          <p className="font-bold">{p.perfiles?.nombre_completo || "Alumno"}</p>
                          <p className="text-xs text-muted-foreground">{format(parseISO(p.pagado_en), "dd/MM/yyyy")}</p>
                        </div>
                        <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                          <span>Pagó: <strong className="text-foreground">{fmt(p.monto)}</strong></span>
                          <span>Academia: <strong className="text-foreground">{fmt(d.academia)}</strong></span>
                          {tabModalidad === "en_vivo" && (
                            <span>Profesor: <strong className="text-foreground">{fmt(d.profesor)}</strong></span>
                          )}
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
                        <span className="text-sm font-bold">{fmt(montoPendienteArs(s))}</span>
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
