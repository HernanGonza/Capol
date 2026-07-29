import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Lock, Eye, EyeOff, CheckCircle, XCircle, ArrowLeft } from "lucide-react";

const passwordChecks = (pw: string) => [
  { label: "Al menos 8 caracteres", ok: pw.length >= 8 },
  { label: "Una mayúscula", ok: /[A-Z]/.test(pw) },
  { label: "Un número", ok: /[0-9]/.test(pw) },
  { label: "Un carácter especial", ok: /[^A-Za-z0-9]/.test(pw) },
];

const ResetPassword = () => {
  const { user, loading, role } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const checks = passwordChecks(password);
  const passwordStrength = checks.filter((c) => c.ok).length;
  const strengthColor = ["bg-red-500", "bg-orange-500", "bg-yellow-500", "bg-lime-500", "bg-emerald-500"][passwordStrength];

  const inputClass = "bg-white/5 border-white/10 text-white placeholder:text-white/20 focus:border-indigo-400 focus:ring-indigo-400/20 rounded-xl";
  const labelClass = "text-white/60 text-xs font-medium";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      toast.error("Las contraseñas no coinciden");
      return;
    }
    if (passwordStrength < 3) {
      toast.error("La contraseña no es suficientemente segura");
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setDone(true);
      toast.success("Contraseña actualizada");
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const goToPanel = () => navigate(role === "teacher" ? "/teacher" : "/dashboard");

  return (
    <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center p-4 relative overflow-hidden">
      <div className="fixed top-0 left-1/4 w-[600px] h-[600px] bg-indigo-500/10 rounded-full blur-[150px] pointer-events-none" />
      <div className="fixed bottom-0 right-1/4 w-[500px] h-[500px] bg-purple-500/10 rounded-full blur-[150px] pointer-events-none" />

      <div className="w-full max-w-md relative z-10">
        <div className="text-center mb-8">
          <img src="/logo-capol.webp" alt="CapOL" className="h-12 w-12 rounded-full object-cover shadow-lg shadow-indigo-500/20 mx-auto" />
        </div>

        <div className="bg-white/5 border border-white/10 rounded-3xl overflow-hidden backdrop-blur-xl shadow-2xl p-8 space-y-5">
          {loading ? (
            <p className="text-center text-white/50 text-sm py-8">Verificando el link...</p>
          ) : !user ? (
            <div className="text-center space-y-4 py-4">
              <XCircle className="w-10 h-10 text-red-400 mx-auto" />
              <div>
                <h1 className="text-lg font-bold text-white">Link inválido o vencido</h1>
                <p className="text-sm text-white/50 mt-1">Pedí un nuevo link de recuperación desde la pantalla de inicio de sesión.</p>
              </div>
              <a href="/auth" className="inline-flex items-center gap-2 text-sm text-indigo-300 hover:text-indigo-200 transition-colors">
                <ArrowLeft className="w-4 h-4" /> Volver a iniciar sesión
              </a>
            </div>
          ) : done ? (
            <div className="text-center space-y-4 py-4">
              <CheckCircle className="w-10 h-10 text-emerald-400 mx-auto" />
              <div>
                <h1 className="text-lg font-bold text-white">¡Contraseña actualizada!</h1>
                <p className="text-sm text-white/50 mt-1">Ya podés seguir usando tu cuenta con la nueva contraseña.</p>
              </div>
              <Button onClick={goToPanel} className="w-full bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 text-white font-bold h-12 rounded-xl shadow-lg shadow-indigo-500/25">
                Ir a mi panel
              </Button>
            </div>
          ) : (
            <>
              <div className="text-center">
                <h1 className="text-lg font-bold text-white">Elegí una nueva contraseña</h1>
                <p className="text-sm text-white/50 mt-1">Tiene que ser distinta a la anterior.</p>
              </div>
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="space-y-1.5">
                  <Label className={labelClass}>Nueva contraseña</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 h-4 w-4 text-white/30" />
                    <Input type={showPassword ? "text" : "password"} placeholder="••••••••" value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className={`pl-9 pr-10 ${inputClass}`} required />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-3 text-white/30 hover:text-white/60">
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {password && (
                    <div className="space-y-2 pt-1">
                      <div className="flex gap-1">
                        {[0, 1, 2, 3].map((i) => (
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
                  <Label className={labelClass}>Repetir contraseña</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 h-4 w-4 text-white/30" />
                    <Input type={showPassword ? "text" : "password"} placeholder="••••••••" value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className={`pl-9 ${inputClass} ${confirmPassword && password !== confirmPassword ? "border-red-500/50" : confirmPassword && password === confirmPassword ? "border-emerald-500/50" : ""}`}
                      required />
                  </div>
                  {confirmPassword && password !== confirmPassword && (
                    <p className="text-xs text-red-400 flex items-center gap-1"><XCircle className="w-3 h-3" /> Las contraseñas no coinciden</p>
                  )}
                </div>
                <Button type="submit" disabled={submitting} className="w-full bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 text-white font-bold h-12 rounded-xl shadow-lg shadow-indigo-500/25">
                  {submitting ? "Guardando..." : "Guardar nueva contraseña"}
                </Button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ResetPassword;
