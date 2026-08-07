import { useState, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import {
  Mail, Lock, User, Phone, MapPin,
  Eye, EyeOff, CheckCircle, XCircle, Camera, ArrowLeft, Shield, CreditCard
} from "lucide-react";
import { PROVINCIAS_AR, PAISES_MUNDO, CODIGO_TELEFONICO } from "@/lib/geo";
import { detectCountryCode, COUNTRY_NAMES } from "@/lib/currency";
import ThemeToggle from "@/components/ThemeToggle";
import { useDocumentMeta } from "@/hooks/use-document-meta";
import { passwordChecks } from "@/lib/password";

const Auth = () => {
  const [searchParams] = useSearchParams();
  const [isLogin, setIsLogin] = useState(searchParams.get("registro") !== "1");
  useDocumentMeta(
    isLogin ? "Iniciar Sesión | CapOL" : "Crear Cuenta | CapOL",
    "/auth",
  );
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  const [forgotMode, setForgotMode] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotSent, setForgotSent] = useState(false);

  const [loginData, setLoginData] = useState({ email: "", password: "" });
  const paisInicial = "Argentina";
  const [form, setForm] = useState({
    nombre_completo: "",
    email: "",
    password: "",
    confirmar_password: "",
    telefono: `${CODIGO_TELEFONICO[paisInicial]} `,
    dni: "",
    edad: "",
    ocupacion: "",
    localidad: "",
    provincia: "",
    pais: paisInicial,
  });
  const [aceptaTerminos, setAceptaTerminos] = useState(false);

  const checks = passwordChecks(form.password);
  const passwordStrength = checks.filter((c) => c.ok).length;
  const strengthColor = ["bg-red-500", "bg-orange-500", "bg-yellow-500", "bg-lime-500", "bg-emerald-500"][passwordStrength];

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarFile(file);
    const reader = new FileReader();
    reader.onload = () => setAvatarPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword(loginData);
      if (error) throw error;
      toast.success("¡Bienvenido de vuelta!");

      // Redirigimos directo al panel según el rol (antes siempre mandaba a
      // /dashboard, que es la vista de alumno; un profesor tenía que hacer
      // un click más para llegar a su panel).
      const { data: roles } = await supabase
        .from("roles_usuario")
        .select("rol")
        .eq("usuario_id", data.user!.id);

      if (roles?.some((r) => r.rol === "teacher")) {
        navigate("/teacher");
      } else {
        navigate("/dashboard");
      }
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      // No confirmamos si el email existe o no (evita filtrar qué cuentas están registradas).
      setForgotSent(true);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.password !== form.confirmar_password) {
      toast.error("Las contraseñas no coinciden");
      return;
    }
    if (passwordStrength < 3) {
      toast.error("La contraseña no es suficientemente segura");
      return;
    }
    if (!aceptaTerminos) {
      toast.error("Tenés que aceptar los Términos y Condiciones para crear una cuenta");
      return;
    }
    setLoading(true);
    try {
      // Primero subir avatar si hay, antes del signUp
      let url_avatar = null;
      if (avatarFile) {
        // Subimos con un nombre temporal basado en timestamp
        const ext = avatarFile.name.split(".").pop();
        const tempName = `temp_${Date.now()}.${ext}`;
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from("avatars")
          .upload(tempName, avatarFile, { upsert: true });
        if (!uploadError && uploadData) {
          const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(uploadData.path);
          url_avatar = urlData.publicUrl;
        }
      }

      // País real detectado por IP (además del que tipea a mano en el
      // formulario) — así se puede contrastar uno contra el otro después
      // desde "Gestión de Alumnos".
      const codigoPaisIp = await detectCountryCode();
      const paisIp = codigoPaisIp ? (COUNTRY_NAMES[codigoPaisIp] || codigoPaisIp) : null;

      // Pasar todos los datos en metadata — el trigger los usa para crear el perfil
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
        options: {
          data: {
            nombre_completo: form.nombre_completo,
            telefono: form.telefono,
            dni: form.dni,
            edad: form.edad,
            ocupacion: form.ocupacion,
            localidad: form.localidad,
            provincia: form.provincia,
            pais: form.pais,
            pais_ip: paisIp,
            avatar_url: url_avatar,
          },
          emailRedirectTo: `${window.location.origin}/dashboard`,
        },
      });
      if (authError) throw authError;

      toast.success("¡Cuenta creada! Revisá tu email para confirmar.");
      setIsLogin(true);
      // Si vuelve a "Crear Cuenta" para registrar a otra persona en la misma
      // sesión del navegador, no puede quedar arrastrando los datos (y la
      // foto) de la cuenta que se acaba de crear.
      setForm({
        nombre_completo: "", email: "", password: "", confirmar_password: "",
        telefono: `${CODIGO_TELEFONICO[paisInicial]} `, dni: "", edad: "", ocupacion: "", localidad: "", provincia: "", pais: paisInicial,
      });
      setAvatarFile(null);
      setAvatarPreview(null);
      setAceptaTerminos(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (error: any) {
      toast.error(error?.message || "No se pudo crear la cuenta. Intentá de nuevo.");
    } finally {
      setLoading(false);
    }
  };

  const inputClass = "bg-white dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-white/20 focus:border-indigo-400 focus:ring-indigo-400/20 rounded-xl";
  const labelClass = "text-slate-600 dark:text-white/60 text-xs font-medium";
  const selectClass = "w-full h-10 rounded-xl bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white text-sm px-3 focus:border-indigo-400 focus:outline-none";
  const optionClass = "bg-white dark:bg-[#1a1a2e]";

  return (
    <>
      <style>{`
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeSlideOut {
          from { opacity: 1; }
          to   { opacity: 0; }
        }
      `}</style>
    <div className="h-screen bg-white dark:bg-[#0a0a0f] text-slate-900 dark:text-white flex items-center justify-center p-4 relative overflow-hidden">
      <div className="fixed inset-0 bg-[linear-gradient(rgba(99,102,241,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(99,102,241,0.03)_1px,transparent_1px)] bg-[size:60px_60px] pointer-events-none" />
      <div className="fixed top-0 left-1/4 w-[600px] h-[600px] bg-indigo-500/10 rounded-full blur-[150px] pointer-events-none" />
      <div className="fixed bottom-0 right-1/4 w-[500px] h-[500px] bg-purple-500/10 rounded-full blur-[150px] pointer-events-none" />

      <div className="fixed top-4 right-4 z-20">
        <ThemeToggle
          collapsed
          className="bg-white/70 dark:bg-white/5 border border-slate-200 dark:border-white/10 backdrop-blur-sm text-slate-500 dark:text-white/70 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5"
        />
      </div>

      <main className="w-full max-w-lg relative z-10">
        {/* Logo */}
        <div className="text-center mb-4">
          <div className="inline-flex items-center gap-3">
            <img src="/logo-capol.webp" alt="" className="h-12 w-12 rounded-full object-cover shadow-lg shadow-indigo-500/20" />
            <div className="text-left">
              <h1 className="font-black text-xl text-slate-900 dark:text-white tracking-tight">CapOL</h1>
              <p className="text-[10px] text-indigo-600/80 dark:text-indigo-300/70 font-medium tracking-[0.2em] uppercase">Escuela Virtual</p>
            </div>
          </div>
        </div>

        <div className="bg-white/70 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-3xl overflow-hidden backdrop-blur-xl shadow-2xl">
          {/* Tabs */}
          <div className="flex border-b border-slate-200 dark:border-white/10">
            {["Iniciar Sesión", "Crear Cuenta"].map((label, i) => (
              <button
                key={label}
                onClick={() => { setIsLogin(i === 0); setForgotMode(false); }}
                className={`flex-1 py-4 text-sm font-bold transition-all ${
                  (i === 0) === isLogin
                    ? "bg-indigo-500/20 text-indigo-600 dark:text-indigo-300 border-b-2 border-indigo-400"
                    : "text-slate-500 dark:text-white/40 hover:text-slate-700 dark:hover:text-white/70"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="p-8 overflow-y-auto max-h-[calc(100vh-12rem)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" key={forgotMode ? "forgot" : isLogin ? "login" : "register"} style={{animation: "fadeSlideIn 0.3s ease"}}>
            {forgotMode ? (
              <div className="space-y-5">
                <button
                  type="button"
                  onClick={() => setForgotMode(false)}
                  className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-white/40 hover:text-slate-700 dark:hover:text-white/70 transition-colors"
                >
                  <ArrowLeft className="w-3.5 h-3.5" /> Volver a iniciar sesión
                </button>
                {forgotSent ? (
                  <div className="text-center space-y-3 py-4">
                    <CheckCircle className="w-10 h-10 text-emerald-400 mx-auto" />
                    <p className="text-sm text-slate-600 dark:text-white/70">
                      Si <strong className="text-slate-900 dark:text-white">{forgotEmail}</strong> está registrado, te enviamos un email con un link para restablecer tu contraseña.
                    </p>
                  </div>
                ) : (
                  <form onSubmit={handleForgotPassword} className="space-y-5">
                    <p className="text-sm text-slate-600 dark:text-white/50">Ingresá tu email y te mandamos un link para restablecer tu contraseña.</p>
                    <div className="space-y-1.5">
                      <Label className={labelClass}>Email</Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-3 h-4 w-4 text-slate-400 dark:text-white/30" />
                        <Input type="email" placeholder="tu@email.com" value={forgotEmail}
                          onChange={(e) => setForgotEmail(e.target.value)}
                          name="email" autoComplete="email"
                          className={`pl-9 ${inputClass}`} required />
                      </div>
                    </div>
                    <Button type="submit" disabled={loading} className="w-full bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 text-white font-bold h-12 rounded-xl shadow-lg shadow-indigo-500/25">
                      {loading ? "Enviando..." : "Enviar link de recuperación"}
                    </Button>
                  </form>
                )}
              </div>
            ) : isLogin ? (
              <form onSubmit={handleLogin} className="space-y-5">
                <div className="space-y-1.5">
                  <Label className={labelClass}>Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 h-4 w-4 text-slate-400 dark:text-white/30" />
                    <Input type="email" placeholder="tu@email.com" value={loginData.email}
                      onChange={(e) => setLoginData({ ...loginData, email: e.target.value })}
                      name="username" autoComplete="username"
                      className={`pl-9 ${inputClass}`} required />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className={labelClass}>Contraseña</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 h-4 w-4 text-slate-400 dark:text-white/30" />
                    <Input type={showPassword ? "text" : "password"} placeholder="••••••••" value={loginData.password}
                      onChange={(e) => setLoginData({ ...loginData, password: e.target.value })}
                      name="current-password" autoComplete="current-password"
                      className={`pl-9 pr-10 ${inputClass}`} required />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"} className="absolute right-3 top-3 text-slate-400 dark:text-white/30 hover:text-slate-600 dark:hover:text-white/60">
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  <div className="text-right">
                    <button
                      type="button"
                      onClick={() => { setForgotMode(true); setForgotSent(false); setForgotEmail(loginData.email); }}
                      className="text-xs text-indigo-600/80 dark:text-indigo-300/70 hover:text-indigo-600 dark:hover:text-indigo-300 transition-colors"
                    >
                      ¿Olvidaste tu contraseña?
                    </button>
                  </div>
                </div>
                <Button type="submit" disabled={loading} className="w-full bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 text-white font-bold h-12 rounded-xl shadow-lg shadow-indigo-500/25 mt-2">
                  {loading ? "Ingresando..." : "Entrar"}
                </Button>
              </form>
            ) : (
              <form onSubmit={handleRegister} className="space-y-6">
                {/* Avatar */}
                <div className="flex flex-col items-center gap-2">
                  <div onClick={() => fileInputRef.current?.click()}
                    className="w-20 h-20 rounded-2xl border-2 border-dashed border-slate-300 dark:border-white/20 hover:border-indigo-400 cursor-pointer flex items-center justify-center overflow-hidden bg-slate-50 dark:bg-white/5 transition-all group">
                    {avatarPreview
                      ? <img src={avatarPreview} className="w-full h-full object-cover" />
                      : <div className="text-center"><Camera className="w-6 h-6 text-slate-400 dark:text-white/30 group-hover:text-indigo-400 mx-auto mb-1 transition-colors" /><p className="text-[10px] text-slate-400 dark:text-white/30 group-hover:text-indigo-600 dark:group-hover:text-indigo-300 transition-colors">Foto</p></div>
                    }
                  </div>
                  <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
                  <p className="text-[11px] text-slate-400 dark:text-white/25">Foto de perfil (opcional)</p>
                </div>

                {/* Datos personales */}
                <div className="space-y-3">
                  <p className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-widest flex items-center gap-2">
                    <User className="w-3 h-3" /> Datos Personales
                  </p>
                  <div className="space-y-1.5">
                    <Label className={labelClass}>Nombre completo *</Label>
                    <Input placeholder="Nombre y Apellido" value={form.nombre_completo}
                      onChange={(e) => setForm({ ...form, nombre_completo: e.target.value })}
                      className={inputClass} required />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className={labelClass}>DNI / Número de identificación *</Label>
                      <div className="relative">
                        <CreditCard className="absolute left-3 top-3 h-4 w-4 text-slate-400 dark:text-white/30" />
                        <Input placeholder="12345678" value={form.dni}
                          onChange={(e) => setForm({ ...form, dni: e.target.value })}
                          className={`pl-9 ${inputClass}`} required />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label className={labelClass}>País *</Label>
                      <select
                        value={form.pais}
                        onChange={(e) => {
                          const nuevoPais = e.target.value;
                          const codigoAnterior = CODIGO_TELEFONICO[form.pais];
                          const codigoNuevo = CODIGO_TELEFONICO[nuevoPais] || "";
                          // Solo pisamos el teléfono si todavía no escribió nada más
                          // que el código anterior (o si está vacío) — si ya tiene su
                          // número cargado, cambiar de país no se lo debe borrar.
                          const telefonoSinTocar =
                            !form.telefono.trim() ||
                            (codigoAnterior && form.telefono.trim() === codigoAnterior);
                          setForm({
                            ...form,
                            pais: nuevoPais,
                            provincia: nuevoPais !== "Argentina" ? "Fuera de Argentina" : "",
                            telefono: telefonoSinTocar ? (codigoNuevo ? `${codigoNuevo} ` : "") : form.telefono,
                          });
                        }}
                        required
                        className={selectClass}
                      >
                        {PAISES_MUNDO.map((p) => <option key={p} value={p} className={optionClass}>{p}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className={labelClass}>Teléfono *</Label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-3 h-4 w-4 text-slate-400 dark:text-white/30" />
                      <Input placeholder="+54 9 ..." value={form.telefono}
                        onChange={(e) => setForm({ ...form, telefono: e.target.value })}
                        className={`pl-9 ${inputClass}`} required />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className={labelClass}>Edad</Label>
                      <Input type="number" min="1" max="120" placeholder="Ej: 28" value={form.edad}
                        onChange={(e) => setForm({ ...form, edad: e.target.value })}
                        className={inputClass} />
                    </div>
                    <div className="space-y-1.5">
                      <Label className={labelClass}>Ocupación</Label>
                      <Input placeholder="Ej: Diseñadora" value={form.ocupacion}
                        onChange={(e) => setForm({ ...form, ocupacion: e.target.value })}
                        className={inputClass} />
                    </div>
                  </div>
                </div>

                {/* Ubicación */}
                <div className="space-y-3">
                  <p className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-widest flex items-center gap-2">
                    <MapPin className="w-3 h-3" /> Ubicación
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className={labelClass}>Localidad</Label>
                      <Input placeholder="Ciudad" value={form.localidad}
                        onChange={(e) => setForm({ ...form, localidad: e.target.value })}
                        className={inputClass} />
                    </div>
                    <div className="space-y-1.5">
                      <Label className={labelClass}>Provincia</Label>
                      <select
                        value={form.pais === "Argentina" ? form.provincia : "Fuera de Argentina"}
                        onChange={(e) => setForm({ ...form, provincia: e.target.value })}
                        disabled={form.pais !== "Argentina"}
                        className={`${selectClass} disabled:opacity-40 disabled:cursor-not-allowed`}
                      >
                        {form.pais !== "Argentina"
                          ? <option value="Fuera de Argentina" className={optionClass}>Fuera de Argentina</option>
                          : <>
                              <option value="" className={optionClass}>Seleccionar</option>
                              {PROVINCIAS_AR.map((p) => <option key={p} value={p} className={optionClass}>{p}</option>)}
                            </>
                        }
                      </select>
                    </div>
                  </div>
                </div>

                {/* Acceso */}
                <div className="space-y-3">
                  <p className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-widest flex items-center gap-2">
                    <Shield className="w-3 h-3" /> Acceso
                  </p>
                  <div className="space-y-1.5">
                    <Label className={labelClass}>Email *</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-3 h-4 w-4 text-slate-400 dark:text-white/30" />
                      <Input type="email" placeholder="tu@email.com" value={form.email}
                        onChange={(e) => setForm({ ...form, email: e.target.value })}
                        name="new-email" autoComplete="off"
                        className={`pl-9 ${inputClass}`} required />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className={labelClass}>Contraseña *</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-3 h-4 w-4 text-slate-400 dark:text-white/30" />
                      <Input type={showPassword ? "text" : "password"} placeholder="••••••••" value={form.password}
                        onChange={(e) => setForm({ ...form, password: e.target.value })}
                        name="new-password" autoComplete="new-password"
                        className={`pl-9 pr-10 ${inputClass}`} required />
                      <button type="button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"} className="absolute right-3 top-3 text-slate-400 dark:text-white/30 hover:text-slate-600 dark:hover:text-white/60">
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    {/* Se deja siempre montado (nunca entra/sale del DOM) y se
                        esconde con CSS: si el bloque aparece y desaparece con
                        cada tecla justo al lado del input de contraseña,
                        choca con el ícono que los gestores de contraseñas del
                        navegador (Bitwarden, LastPass, 1Password) inyectan
                        ahí mismo, y React termina tirando un error de
                        insertBefore al reconciliar contra un DOM que la
                        extensión ya modificó por su cuenta. */}
                    <div className={`space-y-2 overflow-hidden transition-all ${form.password ? "max-h-24 opacity-100 pt-1" : "max-h-0 opacity-0"}`}>
                      <div className="flex gap-1">
                        {[0,1,2,3].map((i) => (
                          <div key={i} className={`h-1 flex-1 rounded-full transition-all ${i < passwordStrength ? strengthColor : "bg-slate-200 dark:bg-white/10"}`} />
                        ))}
                      </div>
                      <div className="grid grid-cols-2 gap-1">
                        {checks.map((c) => (
                          <div key={c.label} className={`flex items-center gap-1 text-[11px] ${c.ok ? "text-emerald-500 dark:text-emerald-400" : "text-slate-400 dark:text-white/30"}`}>
                            <span className="relative inline-block w-3 h-3 shrink-0">
                              <CheckCircle className={`w-3 h-3 absolute inset-0 transition-opacity ${c.ok ? "opacity-100" : "opacity-0"}`} />
                              <XCircle className={`w-3 h-3 absolute inset-0 transition-opacity ${c.ok ? "opacity-0" : "opacity-100"}`} />
                            </span>
                            {c.label}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className={labelClass}>Repetir contraseña *</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-3 h-4 w-4 text-slate-400 dark:text-white/30" />
                      <Input type={showConfirm ? "text" : "password"} placeholder="••••••••" value={form.confirmar_password}
                        onChange={(e) => setForm({ ...form, confirmar_password: e.target.value })}
                        name="confirm-new-password" autoComplete="new-password"
                        className={`pl-9 pr-10 ${inputClass} ${form.confirmar_password && form.password !== form.confirmar_password ? "border-red-500/50" : form.confirmar_password && form.password === form.confirmar_password ? "border-emerald-500/50" : ""}`}
                        required />
                      <button type="button" onClick={() => setShowConfirm(!showConfirm)} aria-label={showConfirm ? "Ocultar contraseña" : "Mostrar contraseña"} className="absolute right-3 top-3 text-slate-400 dark:text-white/30 hover:text-slate-600 dark:hover:text-white/60">
                        {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    {/* Mismo criterio que el medidor de arriba: un solo nodo
                        siempre presente, visibilidad y texto por CSS/estado,
                        nunca se agrega/saca del DOM mientras se escribe. */}
                    <p
                      className={`text-xs flex items-center gap-1 overflow-hidden transition-all ${
                        !form.confirmar_password
                          ? "max-h-0 opacity-0"
                          : form.password === form.confirmar_password
                          ? "max-h-5 opacity-100 text-emerald-400"
                          : "max-h-5 opacity-100 text-red-400"
                      }`}
                    >
                      <span className="relative inline-block w-3 h-3 shrink-0">
                        <CheckCircle className={`w-3 h-3 absolute inset-0 transition-opacity ${form.confirmar_password && form.password === form.confirmar_password ? "opacity-100" : "opacity-0"}`} />
                        <XCircle className={`w-3 h-3 absolute inset-0 transition-opacity ${form.confirmar_password && form.password !== form.confirmar_password ? "opacity-100" : "opacity-0"}`} />
                      </span>
                      {form.confirmar_password && form.password === form.confirmar_password ? "Las contraseñas coinciden" : "Las contraseñas no coinciden"}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-2">
                  <Checkbox
                    id="acepta-terminos"
                    checked={aceptaTerminos}
                    onCheckedChange={(v) => setAceptaTerminos(v === true)}
                    className="mt-0.5"
                  />
                  <Label htmlFor="acepta-terminos" className="text-xs text-slate-500 dark:text-white/50 font-normal leading-snug cursor-pointer">
                    Leí y acepto los{" "}
                    <Link to="/terminos" target="_blank" className="text-indigo-600 dark:text-indigo-400 underline underline-offset-2">
                      Términos y Condiciones
                    </Link>{" "}
                    y la{" "}
                    <Link to="/privacidad" target="_blank" className="text-indigo-600 dark:text-indigo-400 underline underline-offset-2">
                      Política de Privacidad
                    </Link>
                    .
                  </Label>
                </div>

                <Button type="submit" disabled={loading || !aceptaTerminos} className="w-full bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 text-white font-bold h-12 rounded-xl shadow-lg shadow-indigo-500/25">
                  {loading ? "Creando cuenta..." : "Crear Cuenta"}
                </Button>
                <p className="text-center text-[11px] text-slate-400 dark:text-white/25">
                  Al registrarte, recibirás un email de confirmación para activar tu cuenta.
                </p>
              </form>
            )}
          </div>
        </div>

        <div className="text-center mt-4">
          <a href="/" className="text-slate-500 dark:text-white/50 hover:text-slate-700 dark:hover:text-white/60 text-sm flex items-center justify-center gap-2 transition-colors">
            <ArrowLeft className="w-4 h-4" /> Volver al inicio
          </a>
        </div>
      </main>
    </div>
    </>
  );
};

export default Auth;