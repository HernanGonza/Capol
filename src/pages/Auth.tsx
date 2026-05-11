import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  Mail, Lock, User, Phone, MapPin,
  Eye, EyeOff, CheckCircle, XCircle, Camera, ArrowLeft, Shield, CreditCard
} from "lucide-react";

const PROVINCIAS_AR = [
  "Buenos Aires", "CABA", "Catamarca", "Chaco", "Chubut", "Córdoba",
  "Corrientes", "Entre Ríos", "Formosa", "Jujuy", "La Pampa", "La Rioja",
  "Mendoza", "Misiones", "Neuquén", "Río Negro", "Salta", "San Juan",
  "San Luis", "Santa Cruz", "Santa Fe", "Santiago del Estero",
  "Tierra del Fuego", "Tucumán",
];

const passwordChecks = (pw: string) => [
  { label: "Al menos 8 caracteres", ok: pw.length >= 8 },
  { label: "Una mayúscula", ok: /[A-Z]/.test(pw) },
  { label: "Un número", ok: /[0-9]/.test(pw) },
  { label: "Un carácter especial", ok: /[^A-Za-z0-9]/.test(pw) },
];

const PAISES_MUNDO = [
  "Argentina", "Bolivia", "Brasil", "Chile", "Colombia", "Costa Rica",
  "Cuba", "Ecuador", "El Salvador", "Guatemala", "Honduras", "México",
  "Nicaragua", "Panamá", "Paraguay", "Perú", "República Dominicana",
  "Uruguay", "Venezuela",
  "Alemania", "Australia", "Austria", "Bélgica", "Canadá", "China",
  "Corea del Sur", "España", "Estados Unidos", "Francia", "India",
  "Israel", "Italia", "Japón", "Nueva Zelanda", "Países Bajos",
  "Polonia", "Portugal", "Reino Unido", "Rusia", "Sudáfrica",
  "Suecia", "Suiza", "Turquía", "Ucrania",
  "Afghanistan", "Albania", "Algeria", "Andorra", "Angola", "Antigua y Barbuda",
  "Armenia", "Azerbaijan", "Bahamas", "Bahréin", "Bangladesh", "Barbados",
  "Belarus", "Belize", "Benín", "Bután", "Bosnia y Herzegovina", "Botsuana",
  "Brunéi", "Bulgaria", "Burkina Faso", "Burundi", "Cabo Verde", "Camboya",
  "Camerún", "Catar", "Comoras", "Congo", "Croacia", "Chipre",
  "Dinamarca", "Djibouti", "Dominica", "Egipto", "Emiratos Árabes Unidos",
  "Eritrea", "Eslovaquia", "Eslovenia", "Estonia", "Etiopía", "Fiji",
  "Filipinas", "Finlandia", "Gabón", "Gambia", "Georgia", "Ghana",
  "Granada", "Grecia", "Guinea", "Guinea-Bisáu", "Guinea Ecuatorial",
  "Guyana", "Haití", "Hungría", "Indonesia", "Irak", "Irán",
  "Irlanda", "Islandia", "Islas Marshall", "Islas Salomón", "Jamaica",
  "Jordania", "Kazajistán", "Kenia", "Kirguistán", "Kiribati",
  "Kosovo", "Kuwait", "Laos", "Lesoto", "Letonia", "Líbano",
  "Liberia", "Libia", "Liechtenstein", "Lituania", "Luxemburgo",
  "Macedonia del Norte", "Madagascar", "Malasia", "Malaui", "Maldivas",
  "Mali", "Malta", "Marruecos", "Mauricio", "Mauritania", "Micronesia",
  "Moldavia", "Mónaco", "Mongolia", "Montenegro", "Mozambique",
  "Myanmar", "Namibia", "Nauru", "Nepal", "Níger", "Nigeria",
  "Noruega", "Omán", "Pakistán", "Palaos", "Palestina", "Papúa Nueva Guinea",
  "República Centroafricana", "República Checa", "República del Congo",
  "Ruanda", "Rumania", "Saint Kitts y Nevis", "Samoa", "San Marino",
  "Santa Lucía", "Santo Tomé y Príncipe", "San Vicente y las Granadinas",
  "Senegal", "Serbia", "Seychelles", "Sierra Leona", "Singapur",
  "Somalia", "Sri Lanka", "Sudán", "Sudán del Sur", "Surinam",
  "Suazilandia", "Tailandia", "Tanzania", "Timor Oriental", "Togo",
  "Tonga", "Trinidad y Tobago", "Túnez", "Turkmenistán", "Tuvalu",
  "Uganda", "Uzbekistán", "Vanuatu", "Vietnam", "Yemen", "Yibuti",
  "Zambia", "Zimbabue",
];

const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  const [loginData, setLoginData] = useState({ email: "", password: "" });
  const [form, setForm] = useState({
    nombre_completo: "",
    email: "",
    password: "",
    confirmar_password: "",
    telefono: "",
    dni: "",
    direccion: "",
    localidad: "",
    provincia: "",
    pais: "Argentina",
  });

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
      const { error } = await supabase.auth.signInWithPassword(loginData);
      if (error) throw error;
      toast.success("¡Bienvenido de vuelta!");
      navigate("/dashboard");
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

      // Pasar todos los datos en metadata — el trigger los usa para crear el perfil
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
        options: {
          data: {
            nombre_completo: form.nombre_completo,
            telefono: form.telefono,
            dni: form.dni,
            direccion: form.direccion,
            localidad: form.localidad,
            provincia: form.provincia,
            pais: form.pais,
            avatar_url: url_avatar,
          },
          emailRedirectTo: `${window.location.origin}/dashboard`,
        },
      });
      if (authError) throw authError;

      toast.success("¡Cuenta creada! Revisá tu email para confirmar.");
      setIsLogin(true);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const inputClass = "bg-white/5 border-white/10 text-white placeholder:text-white/20 focus:border-indigo-400 focus:ring-indigo-400/20 rounded-xl";
  const labelClass = "text-white/60 text-xs font-medium";

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
    <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center p-4 relative overflow-hidden">
      <div className="fixed inset-0 bg-[linear-gradient(rgba(99,102,241,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(99,102,241,0.03)_1px,transparent_1px)] bg-[size:60px_60px] pointer-events-none" />
      <div className="fixed top-0 left-1/4 w-[600px] h-[600px] bg-indigo-500/10 rounded-full blur-[150px] pointer-events-none" />
      <div className="fixed bottom-0 right-1/4 w-[500px] h-[500px] bg-purple-500/10 rounded-full blur-[150px] pointer-events-none" />

      <div className="w-full max-w-lg relative z-10">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-3">
            <img src="/logo-capol.webp" alt="CAPOL" className="h-12 w-12 rounded-xl shadow-lg shadow-indigo-500/20" />
            <div className="text-left">
              <p className="font-black text-xl text-white tracking-tight">CAPOL</p>
              <p className="text-[10px] text-indigo-300/70 font-medium tracking-[0.2em] uppercase">Escuela Virtual</p>
            </div>
          </div>
        </div>

        <div className="bg-white/5 border border-white/10 rounded-3xl overflow-hidden backdrop-blur-xl shadow-2xl">
          {/* Tabs */}
          <div className="flex border-b border-white/10">
            {["Iniciar Sesión", "Crear Cuenta"].map((label, i) => (
              <button
                key={label}
                onClick={() => setIsLogin(i === 0)}
                className={`flex-1 py-4 text-sm font-bold transition-all ${
                  (i === 0) === isLogin
                    ? "bg-indigo-500/20 text-indigo-300 border-b-2 border-indigo-400"
                    : "text-white/40 hover:text-white/70"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="p-8 overflow-y-auto max-h-[72vh] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" key={isLogin ? "login" : "register"} style={{animation: "fadeSlideIn 0.3s ease"}}>
            {isLogin ? (
              <form onSubmit={handleLogin} className="space-y-5">
                <div className="space-y-1.5">
                  <Label className={labelClass}>Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 h-4 w-4 text-white/30" />
                    <Input type="email" placeholder="tu@email.com" value={loginData.email}
                      onChange={(e) => setLoginData({ ...loginData, email: e.target.value })}
                      className={`pl-9 ${inputClass}`} required />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className={labelClass}>Contraseña</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 h-4 w-4 text-white/30" />
                    <Input type={showPassword ? "text" : "password"} placeholder="••••••••" value={loginData.password}
                      onChange={(e) => setLoginData({ ...loginData, password: e.target.value })}
                      className={`pl-9 pr-10 ${inputClass}`} required />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-3 text-white/30 hover:text-white/60">
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
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
                    className="w-20 h-20 rounded-2xl border-2 border-dashed border-white/20 hover:border-indigo-400 cursor-pointer flex items-center justify-center overflow-hidden bg-white/5 transition-all group">
                    {avatarPreview
                      ? <img src={avatarPreview} className="w-full h-full object-cover" />
                      : <div className="text-center"><Camera className="w-6 h-6 text-white/30 group-hover:text-indigo-400 mx-auto mb-1 transition-colors" /><p className="text-[10px] text-white/30 group-hover:text-indigo-300 transition-colors">Foto</p></div>
                    }
                  </div>
                  <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
                  <p className="text-[11px] text-white/25">Foto de perfil (opcional)</p>
                </div>

                {/* Datos personales */}
                <div className="space-y-3">
                  <p className="text-[11px] font-bold text-indigo-400 uppercase tracking-widest flex items-center gap-2">
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
                      <Label className={labelClass}>DNI *</Label>
                      <div className="relative">
                        <CreditCard className="absolute left-3 top-3 h-4 w-4 text-white/30" />
                        <Input placeholder="12345678" value={form.dni}
                          onChange={(e) => setForm({ ...form, dni: e.target.value })}
                          className={`pl-9 ${inputClass}`} required />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label className={labelClass}>Teléfono *</Label>
                      <div className="relative">
                        <Phone className="absolute left-3 top-3 h-4 w-4 text-white/30" />
                        <Input placeholder="+54 9 ..." value={form.telefono}
                          onChange={(e) => setForm({ ...form, telefono: e.target.value })}
                          className={`pl-9 ${inputClass}`} required />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Ubicación */}
                <div className="space-y-3">
                  <p className="text-[11px] font-bold text-indigo-400 uppercase tracking-widest flex items-center gap-2">
                    <MapPin className="w-3 h-3" /> Ubicación
                  </p>
                  <div className="space-y-1.5">
                    <Label className={labelClass}>Dirección</Label>
                    <Input placeholder="Calle 123" value={form.direccion}
                      onChange={(e) => setForm({ ...form, direccion: e.target.value })}
                      className={inputClass} />
                  </div>
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
                        className="w-full h-10 rounded-xl bg-white/5 border border-white/10 text-white text-sm px-3 focus:border-indigo-400 focus:outline-none disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        {form.pais !== "Argentina"
                          ? <option value="Fuera de Argentina" className="bg-[#1a1a2e]">Fuera de Argentina</option>
                          : <>
                              <option value="" className="bg-[#1a1a2e]">Seleccionar</option>
                              {PROVINCIAS_AR.map((p) => <option key={p} value={p} className="bg-[#1a1a2e]">{p}</option>)}
                            </>
                        }
                      </select>
                    </div>
                    <div className="col-span-2 space-y-1.5">
                      <Label className={labelClass}>País</Label>
                      <select
                        value={form.pais}
                        onChange={(e) => {
                          const nuevoPais = e.target.value;
                          setForm({ ...form, pais: nuevoPais, provincia: nuevoPais !== "Argentina" ? "Fuera de Argentina" : "" });
                        }}
                        className="w-full h-10 rounded-xl bg-white/5 border border-white/10 text-white text-sm px-3 focus:border-indigo-400 focus:outline-none"
                      >
                        {PAISES_MUNDO.map((p) => <option key={p} value={p} className="bg-[#1a1a2e]">{p}</option>)}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Acceso */}
                <div className="space-y-3">
                  <p className="text-[11px] font-bold text-indigo-400 uppercase tracking-widest flex items-center gap-2">
                    <Shield className="w-3 h-3" /> Acceso
                  </p>
                  <div className="space-y-1.5">
                    <Label className={labelClass}>Email *</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-3 h-4 w-4 text-white/30" />
                      <Input type="email" placeholder="tu@email.com" value={form.email}
                        onChange={(e) => setForm({ ...form, email: e.target.value })}
                        className={`pl-9 ${inputClass}`} required />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className={labelClass}>Contraseña *</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-3 h-4 w-4 text-white/30" />
                      <Input type={showPassword ? "text" : "password"} placeholder="••••••••" value={form.password}
                        onChange={(e) => setForm({ ...form, password: e.target.value })}
                        className={`pl-9 pr-10 ${inputClass}`} required />
                      <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-3 text-white/30 hover:text-white/60">
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    {form.password && (
                      <div className="space-y-2 pt-1">
                        <div className="flex gap-1">
                          {[0,1,2,3].map((i) => (
                            <div key={i} className={`h-1 flex-1 rounded-full transition-all ${i < passwordStrength ? strengthColor : "bg-white/10"}`} />
                          ))}
                        </div>
                        <div className="grid grid-cols-2 gap-1">
                          {checks.map((c) => (
                            <div key={c.label} className={`flex items-center gap-1 text-[11px] ${c.ok ? "text-emerald-400" : "text-white/30"}`}>
                              {c.ok ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                              {c.label}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <Label className={labelClass}>Repetir contraseña *</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-3 h-4 w-4 text-white/30" />
                      <Input type={showConfirm ? "text" : "password"} placeholder="••••••••" value={form.confirmar_password}
                        onChange={(e) => setForm({ ...form, confirmar_password: e.target.value })}
                        className={`pl-9 pr-10 ${inputClass} ${form.confirmar_password && form.password !== form.confirmar_password ? "border-red-500/50" : form.confirmar_password && form.password === form.confirmar_password ? "border-emerald-500/50" : ""}`}
                        required />
                      <button type="button" onClick={() => setShowConfirm(!showConfirm)} className="absolute right-3 top-3 text-white/30 hover:text-white/60">
                        {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    {form.confirmar_password && form.password !== form.confirmar_password && (
                      <p className="text-xs text-red-400 flex items-center gap-1"><XCircle className="w-3 h-3" /> Las contraseñas no coinciden</p>
                    )}
                    {form.confirmar_password && form.password === form.confirmar_password && (
                      <p className="text-xs text-emerald-400 flex items-center gap-1"><CheckCircle className="w-3 h-3" /> Las contraseñas coinciden</p>
                    )}
                  </div>
                </div>

                <Button type="submit" disabled={loading} className="w-full bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 text-white font-bold h-12 rounded-xl shadow-lg shadow-indigo-500/25">
                  {loading ? "Creando cuenta..." : "Crear Cuenta"}
                </Button>
                <p className="text-center text-[11px] text-white/25">
                  Al registrarte, recibirás un email de confirmación para activar tu cuenta.
                </p>
              </form>
            )}
          </div>
        </div>

        <div className="text-center mt-6">
          <a href="/" className="text-white/30 hover:text-white/60 text-sm flex items-center justify-center gap-2 transition-colors">
            <ArrowLeft className="w-4 h-4" /> Volver al inicio
          </a>
        </div>
      </div>
    </div>
    </>
  );
};

export default Auth;