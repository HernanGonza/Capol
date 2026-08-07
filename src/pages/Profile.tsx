import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import SignaturePad from "@/components/SignaturePad";
import { toast } from "sonner";
import { Camera, Mail, User, Phone, MapPin, CreditCard, PenTool, Lock, Eye, EyeOff } from "lucide-react";
import { PROVINCIAS_AR, PAISES_MUNDO } from "@/lib/geo";
import { passwordChecks } from "@/lib/password";
import { traducirErrorAuth } from "@/lib/authErrors";

const Profile = () => {
  const { user, profile, role, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [editingSignature, setEditingSignature] = useState(false);
  const [savingSignature, setSavingSignature] = useState(false);
  const [editingDirectorSignature, setEditingDirectorSignature] = useState(false);
  const [savingDirectorSignature, setSavingDirectorSignature] = useState(false);
  const [form, setForm] = useState({
    nombre_completo: "",
    telefono: "",
    dni: "",
    edad: "",
    ocupacion: "",
    direccion: "",
    localidad: "",
    provincia: "",
    pais: "Argentina",
    biografia: "",
  });
  const [passwordForm, setPasswordForm] = useState({ actual: "", nueva: "", confirmar: "" });
  const [showPasswords, setShowPasswords] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

  // Cargamos el form una vez tengamos el perfil (llega async desde el contexto).
  useEffect(() => {
    if (profile) {
      setForm({
        nombre_completo: profile.nombre_completo || "",
        telefono: profile.telefono || "",
        dni: profile.dni || "",
        edad: profile.edad?.toString() || "",
        ocupacion: profile.ocupacion || "",
        direccion: profile.direccion || "",
        localidad: profile.localidad || "",
        provincia: profile.provincia || "",
        pais: profile.pais || "Argentina",
        biografia: profile.biografia || "",
      });
    }
  }, [profile]);

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarFile(file);
    const reader = new FileReader();
    reader.onload = () => setAvatarPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  // Firma de "Dirección": compartida entre todos los admins, no es de una
  // cuenta puntual — se guarda como una fila más en configuracion_global,
  // mismo patrón que "medios_de_pago".
  const { data: directorSignatureUrl } = useQuery({
    queryKey: ["firma-director"],
    queryFn: async () => {
      const { data } = await supabase.from("configuracion_global").select("valor").eq("clave", "firma_director").maybeSingle();
      return (data?.valor as { url?: string } | null)?.url || null;
    },
    enabled: role === "admin",
  });

  const handleSaveSignature = async (file: File) => {
    if (!user) return;
    setSavingSignature(true);
    try {
      const path = `profesor-${user.id}.png`;
      const { error } = await supabase.storage.from("firmas").upload(path, file, { upsert: true });
      if (error) throw error;
      const { data } = supabase.storage.from("firmas").getPublicUrl(path);
      const url = `${data.publicUrl}?t=${Date.now()}`;
      const { error: updErr } = await supabase.from("perfiles").update({ firma_url: url }).eq("id", user.id);
      if (updErr) throw updErr;
      await refreshProfile();
      setEditingSignature(false);
      toast.success("Firma guardada");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSavingSignature(false);
    }
  };

  const handleSaveDirectorSignature = async (file: File) => {
    setSavingDirectorSignature(true);
    try {
      const path = "director.png";
      const { error } = await supabase.storage.from("firmas").upload(path, file, { upsert: true });
      if (error) throw error;
      const { data } = supabase.storage.from("firmas").getPublicUrl(path);
      const url = `${data.publicUrl}?t=${Date.now()}`;
      const { error: cfgErr } = await supabase.from("configuracion_global").upsert({ clave: "firma_director", valor: { url } });
      if (cfgErr) throw cfgErr;
      queryClient.invalidateQueries({ queryKey: ["firma-director"] });
      setEditingDirectorSignature(false);
      toast.success("Firma de dirección guardada");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSavingDirectorSignature(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    try {
      let url_avatar = profile?.url_avatar || null;
      if (avatarFile) {
        const ext = avatarFile.name.split(".").pop();
        const path = `${user.id}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from("avatars")
          .upload(path, avatarFile, { upsert: true });
        if (uploadError) throw uploadError;
        const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(path);
        // Cache-busting: si el nombre de archivo no cambia (mismo usuario), el
        // navegador podría seguir mostrando la imagen vieja desde caché.
        url_avatar = `${urlData.publicUrl}?t=${Date.now()}`;
      }

      const { error } = await supabase.from("perfiles").update({
        nombre_completo: form.nombre_completo,
        telefono: form.telefono,
        dni: form.dni,
        edad: form.edad ? parseInt(form.edad) : null,
        ocupacion: form.ocupacion,
        direccion: form.direccion,
        localidad: form.localidad,
        provincia: form.provincia,
        pais: form.pais,
        biografia: form.biografia,
        url_avatar,
      }).eq("id", user.id);
      if (error) throw error;

      await refreshProfile();
      setAvatarFile(null);
      setAvatarPreview(null);
      toast.success("Perfil actualizado");
      navigate(role === "teacher" ? "/teacher" : "/dashboard");
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  };

  // Supabase no tiene un endpoint dedicado para "cambiar contraseña
  // verificando la actual" — updateUser() la cambia directo sin pedir nada
  // más. Por eso primero se re-autentica con la contraseña actual (si no es
  // la correcta, esto falla) y recién después se actualiza a la nueva.
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.email) return;
    if (passwordForm.nueva !== passwordForm.confirmar) {
      toast.error("Las contraseñas nuevas no coinciden");
      return;
    }
    if (passwordChecks(passwordForm.nueva).some((c) => !c.ok)) {
      toast.error("La contraseña nueva no es suficientemente segura");
      return;
    }
    setChangingPassword(true);
    try {
      const { error: verifyError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: passwordForm.actual,
      });
      if (verifyError) {
        toast.error("La contraseña actual no es correcta");
        return;
      }
      const { error } = await supabase.auth.updateUser({ password: passwordForm.nueva });
      if (error) throw error;
      toast.success("Contraseña actualizada");
      setPasswordForm({ actual: "", nueva: "", confirmar: "" });
    } catch (error: any) {
      toast.error(traducirErrorAuth(error));
    } finally {
      setChangingPassword(false);
    }
  };

  const currentAvatar = avatarPreview || profile?.url_avatar;
  const newPasswordChecks = passwordForm.nueva ? passwordChecks(passwordForm.nueva) : [];

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Mi Perfil</h1>
          <p className="text-muted-foreground">Actualizá tus datos personales y tu foto.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <Card className="shadow-card border-none">
            <CardContent className="p-6 flex items-center gap-5">
              <div
                onClick={() => fileInputRef.current?.click()}
                className="relative w-20 h-20 rounded-full overflow-hidden shrink-0 cursor-pointer border-2 border-dashed border-border hover:border-primary transition-colors flex items-center justify-center bg-muted group"
              >
                {currentAvatar ? (
                  <img src={currentAvatar} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <User className="w-8 h-8 text-muted-foreground" />
                )}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <Camera className="w-5 h-5 text-white" />
                </div>
              </div>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
              <div>
                <p className="font-bold">{form.nombre_completo || "Sin nombre"}</p>
                <p className="text-sm text-muted-foreground flex items-center gap-1.5"><Mail className="w-3.5 h-3.5" /> {user?.email}</p>
                <button type="button" onClick={() => fileInputRef.current?.click()} className="text-xs font-semibold text-primary hover:underline mt-1">
                  Cambiar foto
                </button>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-card border-none">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2"><User className="w-4 h-4 text-primary" /> Datos personales</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold uppercase text-muted-foreground">Nombre completo</Label>
                <Input value={form.nombre_completo} onChange={(e) => setForm({ ...form, nombre_completo: e.target.value })} required />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold uppercase text-muted-foreground">DNI / Número de identificación</Label>
                  <div className="relative">
                    <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input className="pl-9" value={form.dni} onChange={(e) => setForm({ ...form, dni: e.target.value })} />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold uppercase text-muted-foreground">Teléfono</Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input className="pl-9" value={form.telefono} onChange={(e) => setForm({ ...form, telefono: e.target.value })} />
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold uppercase text-muted-foreground">Edad</Label>
                  <Input type="number" min="1" max="120" value={form.edad} onChange={(e) => setForm({ ...form, edad: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold uppercase text-muted-foreground">Ocupación</Label>
                  <Input value={form.ocupacion} onChange={(e) => setForm({ ...form, ocupacion: e.target.value })} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-bold uppercase text-muted-foreground">Biografía</Label>
                <Textarea rows={3} placeholder="Contanos un poco sobre vos..." value={form.biografia} onChange={(e) => setForm({ ...form, biografia: e.target.value })} />
              </div>
            </CardContent>
          </Card>

          {role === "teacher" && (
            <Card className="shadow-card border-none">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2"><PenTool className="w-4 h-4 text-primary" /> Mi firma</CardTitle>
                <p className="text-xs text-muted-foreground">Se usa en los certificados de finalización de tus cursos.</p>
              </CardHeader>
              <CardContent>
                {profile?.firma_url && !editingSignature ? (
                  <div className="flex items-center gap-4 flex-wrap">
                    <img src={profile.firma_url} alt="Tu firma" className="h-16 max-w-[160px] sm:max-w-[220px] object-contain bg-white rounded-lg border px-3" />
                    <Button type="button" variant="outline" size="sm" onClick={() => setEditingSignature(true)}>Volver a firmar</Button>
                  </div>
                ) : (
                  <SignaturePad saving={savingSignature} onSave={handleSaveSignature} />
                )}
              </CardContent>
            </Card>
          )}

          {role === "admin" && (
            <Card className="shadow-card border-none">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2"><PenTool className="w-4 h-4 text-primary" /> Firma de Dirección</CardTitle>
                <p className="text-xs text-muted-foreground">Firma compartida que se usa en todos los certificados emitidos por la escuela. Cualquier admin la puede actualizar.</p>
              </CardHeader>
              <CardContent>
                {directorSignatureUrl && !editingDirectorSignature ? (
                  <div className="flex items-center gap-4 flex-wrap">
                    <img src={directorSignatureUrl} alt="Firma de dirección" className="h-16 max-w-[160px] sm:max-w-[220px] object-contain bg-white rounded-lg border px-3" />
                    <Button type="button" variant="outline" size="sm" onClick={() => setEditingDirectorSignature(true)}>Volver a firmar</Button>
                  </div>
                ) : (
                  <SignaturePad saving={savingDirectorSignature} onSave={handleSaveDirectorSignature} />
                )}
              </CardContent>
            </Card>
          )}

          <Card className="shadow-card border-none">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2"><MapPin className="w-4 h-4 text-primary" /> Ubicación</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold uppercase text-muted-foreground">Dirección</Label>
                <Input value={form.direccion} onChange={(e) => setForm({ ...form, direccion: e.target.value })} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold uppercase text-muted-foreground">Localidad</Label>
                  <Input value={form.localidad} onChange={(e) => setForm({ ...form, localidad: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold uppercase text-muted-foreground">Provincia</Label>
                  <select
                    value={form.pais === "Argentina" ? form.provincia : "Fuera de Argentina"}
                    onChange={(e) => setForm({ ...form, provincia: e.target.value })}
                    disabled={form.pais !== "Argentina"}
                    className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {form.pais !== "Argentina" ? (
                      <option value="Fuera de Argentina">Fuera de Argentina</option>
                    ) : (
                      <>
                        <option value="">Seleccionar</option>
                        {PROVINCIAS_AR.map((p) => <option key={p} value={p}>{p}</option>)}
                      </>
                    )}
                  </select>
                </div>
                <div className="col-span-2 space-y-1.5">
                  <Label className="text-xs font-bold uppercase text-muted-foreground">País</Label>
                  <select
                    value={form.pais}
                    onChange={(e) => {
                      const nuevoPais = e.target.value;
                      setForm({ ...form, pais: nuevoPais, provincia: nuevoPais !== "Argentina" ? "Fuera de Argentina" : "" });
                    }}
                    className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    {PAISES_MUNDO.map((p) => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
              </div>
            </CardContent>
          </Card>

          <Button type="submit" className="w-full gradient-primary text-primary-foreground h-11" disabled={saving}>
            {saving ? "Guardando..." : "Guardar cambios"}
          </Button>
        </form>

        <form onSubmit={handleChangePassword}>
          <Card className="shadow-card border-none">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2"><Lock className="w-4 h-4 text-primary" /> Cambiar contraseña</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold uppercase text-muted-foreground">Contraseña actual</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    className="pl-9 pr-9"
                    type={showPasswords ? "text" : "password"}
                    value={passwordForm.actual}
                    onChange={(e) => setPasswordForm({ ...passwordForm, actual: e.target.value })}
                    autoComplete="current-password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPasswords(!showPasswords)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPasswords ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold uppercase text-muted-foreground">Contraseña nueva</Label>
                  <Input
                    type={showPasswords ? "text" : "password"}
                    value={passwordForm.nueva}
                    onChange={(e) => setPasswordForm({ ...passwordForm, nueva: e.target.value })}
                    autoComplete="new-password"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold uppercase text-muted-foreground">Repetir contraseña nueva</Label>
                  <Input
                    type={showPasswords ? "text" : "password"}
                    value={passwordForm.confirmar}
                    onChange={(e) => setPasswordForm({ ...passwordForm, confirmar: e.target.value })}
                    autoComplete="new-password"
                    required
                  />
                </div>
              </div>
              {passwordForm.nueva && (
                <div className="grid grid-cols-2 gap-1.5">
                  {newPasswordChecks.map((c) => (
                    <p key={c.label} className={`text-xs flex items-center gap-1.5 ${c.ok ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"}`}>
                      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${c.ok ? "bg-emerald-500" : "bg-muted-foreground/40"}`} />
                      {c.label}
                    </p>
                  ))}
                </div>
              )}
              <Button type="submit" variant="outline" className="w-full" disabled={changingPassword}>
                {changingPassword ? "Cambiando..." : "Cambiar contraseña"}
              </Button>
            </CardContent>
          </Card>
        </form>
      </div>
    </AppLayout>
  );
};

export default Profile;
