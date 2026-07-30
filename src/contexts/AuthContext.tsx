import { createContext, useContext, useEffect, useRef, useState, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type AppRole = Database["public"]["Enums"]["app_role"];

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  role: AppRole | null;
  profile: Database["public"]["Tables"]["perfiles"]["Row"] | null;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true,
  role: null,
  profile: null,
  signOut: async () => {},
  refreshProfile: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<AppRole | null>(null);
  const [profile, setProfile] = useState<Database["public"]["Tables"]["perfiles"]["Row"] | null>(null);
  const navigate = useNavigate();
  // Identifica cuál es la fetch de rol/perfil "vigente": si el usuario cierra
  // sesión o cambia de cuenta rápido, una fetch vieja que todavía está en
  // vuelo puede resolver DESPUÉS y pisar el estado correcto con datos de otro
  // usuario — este contador descarta cualquier resultado que ya quedó viejo.
  const fetchIdRef = useRef(0);

  // OJO: esta función NO debe llamar a ningún método de supabase.auth.* (getUser,
  // getSession, refreshSession, etc.) — eso es lo que dispara el deadlock conocido
  // de Supabase cuando se ejecuta a raíz de un evento de auth. Ya tenemos todo lo
  // que necesitamos del usuario en el objeto "authUser" que nos pasa la sesión.
  const fetchUserData = async (authUser: User) => {
    const requestId = ++fetchIdRef.current;
    const [{ data: roles }, { data: prof }] = await Promise.all([
      supabase.from("roles_usuario").select("rol").eq("usuario_id", authUser.id),
      supabase.from("perfiles").select("*").eq("id", authUser.id).single(),
    ]);

    // Si mientras esperábamos esta respuesta ya se disparó un logout o un
    // login de otra cuenta, esta fetch quedó vieja — no pisar el estado.
    if (fetchIdRef.current !== requestId) return;

    if (roles && roles.length > 0) setRole(roles[0].rol);

    // Si el perfil tiene campos vacíos pero el metadata los tiene, sincronizar
    // (chequeamos cada campo por separado: un perfil puede tener el teléfono
    // cargado pero no el DNI/dirección, y antes alcanzaba con que telefono ya
    // estuviera para saltear la sincronización de TODOS los demás campos).
    if (prof) {
      const meta = authUser.user_metadata || {};
      const needsSync =
        (!prof.telefono && meta.telefono) ||
        (!prof.dni && meta.dni) ||
        (!prof.direccion && meta.direccion) ||
        (!prof.localidad && meta.localidad) ||
        (!prof.provincia && meta.provincia);
      if (needsSync) {
        const { data: updated } = await supabase.from("perfiles").update({
          telefono: meta.telefono || prof.telefono,
          dni: meta.dni || prof.dni,
          direccion: meta.direccion || prof.direccion,
          localidad: meta.localidad || prof.localidad,
          provincia: meta.provincia || prof.provincia,
          pais: meta.pais || prof.pais || "Argentina",
          nombre_completo: meta.nombre_completo || prof.nombre_completo,
          url_avatar: meta.avatar_url || prof.url_avatar,
        }).eq("id", authUser.id).select().single();
        if (fetchIdRef.current !== requestId) return;
        if (updated) { setProfile(updated); return; }
      }
      setProfile(prof);
    }
  };

  useEffect(() => {
    let cancelled = false;

    // Red de seguridad: pase lo que pase (deadlock, timeout de red, lo que sea),
    // nunca dejamos el spinner de carga trabado más de unos segundos.
    const safetyTimeout = setTimeout(() => {
      if (!cancelled) setLoading(false);
    }, 6000);

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, newSession) => {
        setSession(newSession);

        // Comparamos contra el usuario previo con el updater de setUser (en vez de
        // leer la variable "user" del closure, que quedaría stale al estar este
        // efecto con deps []). Esto nos permite distinguir un login real de un
        // simple TOKEN_REFRESHED — Supabase dispara este último automáticamente
        // cada vez que la pestaña recupera el foco, y si tratáramos ese caso igual
        // que un login (loading=true) desmontaríamos toda la ruta protegida cada
        // vez que el usuario vuelve de otra pestaña, perdiendo su estado (por eso
        // la app "volvía al principio" al cambiar de pestaña).
        setUser((prevUser) => {
          const newUser = newSession?.user ?? null;
          const isNewUser = prevUser?.id !== newUser?.id;

          if (newUser) {
            if (isNewUser) {
              // Al iniciar sesión hay que poner loading=true mientras se busca el
              // rol — si no, cualquier pantalla que decida una ruta según el rol
              // lo ve como null por un instante (por eso un profesor terminaba en
              // /dashboard en vez de /teacher).
              setLoading(true);
              // No se puede hacer `await` de una llamada a Supabase directo adentro
              // del callback de onAuthStateChange (deadlock conocido). Se difiere
              // con setTimeout, y recién ahí se consulta rol/perfil.
              setTimeout(() => {
                fetchUserData(newUser).finally(() => { if (!cancelled) setLoading(false); });
              }, 0);
            }
          } else {
            // Invalida cualquier fetch de rol/perfil todavía en vuelo (de la
            // cuenta anterior) para que no pise este estado si resuelve tarde.
            fetchIdRef.current++;
            setRole(null);
            setProfile(null);
            setLoading(false);
          }

          return newUser;
        });
      }
    );

    supabase.auth.getSession().then(({ data: { session: initialSession } }) => {
      setSession(initialSession);
      setUser(initialSession?.user ?? null);
      if (initialSession?.user) {
        fetchUserData(initialSession.user).finally(() => { if (!cancelled) setLoading(false); });
      } else {
        setLoading(false);
      }
    });

    return () => {
      cancelled = true;
      clearTimeout(safetyTimeout);
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    // Invalida cualquier fetch de rol/perfil en vuelo ANTES de esperar a que
    // termine el signOut, para que no pueda resolver después y pisar el
    // estado ya limpio con datos de la cuenta que se está cerrando.
    fetchIdRef.current++;
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setRole(null);
    setProfile(null);
    navigate("/");
  };

  // Vuelve a leer el perfil desde la base — se usa después de guardar cambios
  // en "Mi Perfil" para que el sidebar (avatar, nombre) se actualice al toque,
  // sin depender de que vuelva a dispararse un evento de auth.
  const refreshProfile = async () => {
    if (!user) return;
    const { data: prof } = await supabase.from("perfiles").select("*").eq("id", user.id).single();
    if (prof) setProfile(prof);
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, role, profile, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
};