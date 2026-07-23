import { createContext, useContext, useEffect, useState, ReactNode } from "react";
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
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true,
  role: null,
  profile: null,
  signOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<AppRole | null>(null);
  const [profile, setProfile] = useState<Database["public"]["Tables"]["perfiles"]["Row"] | null>(null);
  const navigate = useNavigate();

  // OJO: esta función NO debe llamar a ningún método de supabase.auth.* (getUser,
  // getSession, refreshSession, etc.) — eso es lo que dispara el deadlock conocido
  // de Supabase cuando se ejecuta a raíz de un evento de auth. Ya tenemos todo lo
  // que necesitamos del usuario en el objeto "authUser" que nos pasa la sesión.
  const fetchUserData = async (authUser: User) => {
    const [{ data: roles }, { data: prof }] = await Promise.all([
      supabase.from("roles_usuario").select("rol").eq("usuario_id", authUser.id),
      supabase.from("perfiles").select("*").eq("id", authUser.id).single(),
    ]);
    if (roles && roles.length > 0) setRole(roles[0].rol);

    // Si el perfil tiene campos vacíos pero el metadata los tiene, sincronizar
    if (prof) {
      const meta = authUser.user_metadata || {};
      const needsSync = !prof.telefono && (meta.telefono || meta.dni || meta.direccion);
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
        setUser(newSession?.user ?? null);
        if (newSession?.user) {
          // Importante: si ya habíamos terminado de cargar antes (ej: se mostró
          // la pantalla de login sin usuario logueado), "loading" ya estaba en
          // false. Al iniciar sesión hay que volver a ponerlo en true mientras
          // se busca el rol — si no, cualquier pantalla que decida una ruta
          // según el rol lo ve como null por un instante (por eso un profesor
          // terminaba en /dashboard en vez de /teacher).
          setLoading(true);
          // No se puede hacer `await` de una llamada a Supabase directo adentro
          // del callback de onAuthStateChange (deadlock conocido). Se difiere
          // con setTimeout, y recién ahí se consulta rol/perfil.
          const authUser = newSession.user;
          setTimeout(() => {
            fetchUserData(authUser).finally(() => { if (!cancelled) setLoading(false); });
          }, 0);
        } else {
          setRole(null);
          setProfile(null);
          setLoading(false);
        }
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
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setRole(null);
    setProfile(null);
    navigate("/");
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, role, profile, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};