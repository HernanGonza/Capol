import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  User,
  Mail,
  Phone,
  CreditCard,
  MapPin,
  Briefcase,
  Cake,
} from "lucide-react";

interface Perfil {
  nombre_completo?: string | null;
  email?: string | null;
  telefono?: string | null;
  dni?: string | null;
  edad?: number | null;
  ocupacion?: string | null;
  direccion?: string | null;
  localidad?: string | null;
  provincia?: string | null;
  pais?: string | null;
  biografia?: string | null;
  url_avatar?: string | null;
  creado_en?: string | null;
}

interface StudentProfileModalProps {
  perfil: Perfil | null | undefined;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Modal con todos los datos del registro de un alumno (usado, por ej., al
// tocar su nombre en Suscripciones). Reutilizable donde haga falta el
// detalle completo de un perfil.
const StudentProfileModal = ({
  perfil,
  open,
  onOpenChange,
}: StudentProfileModalProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[440px]">
        {perfil && (
          <div className="space-y-5">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-indigo-100 dark:bg-indigo-950/50 flex items-center justify-center overflow-hidden shrink-0">
                {perfil.url_avatar ? (
                  <img
                    src={perfil.url_avatar}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <User className="w-7 h-7 text-indigo-400" />
                )}
              </div>

              <div>
                <DialogTitle asChild>
                  <h2 className="text-xl font-black">
                    {perfil.nombre_completo}
                  </h2>
                </DialogTitle>

                <DialogDescription className="sr-only">
                  Datos completos del registro de este alumno
                </DialogDescription>

                <p className="text-xs text-muted-foreground">
                  {perfil.email}
                </p>

                {perfil.creado_en && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Registrado el{" "}
                    {new Date(perfil.creado_en).toLocaleDateString(
                      "es-AR",
                      { day: "numeric", month: "long", year: "numeric" }
                    )}
                  </p>
                )}
              </div>
            </div>

            {perfil.biografia && (
              <p className="text-sm text-muted-foreground italic border-l-2 border-indigo-200 dark:border-indigo-900 pl-3">
                {perfil.biografia}
              </p>
            )}

            <div className="space-y-3">
              <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                Datos del registro
              </p>

              <InfoRow icon={Mail} label="Email" value={perfil.email} />

              <InfoRow
                icon={Phone}
                label="Teléfono"
                value={perfil.telefono}
              />

              <InfoRow icon={CreditCard} label="DNI" value={perfil.dni} />

              <InfoRow
                icon={Cake}
                label="Edad"
                value={
                  perfil.edad != null ? `${perfil.edad} años` : null
                }
              />

              <InfoRow
                icon={Briefcase}
                label="Ocupación"
                value={perfil.ocupacion}
              />

              <InfoRow
                icon={MapPin}
                label="Dirección"
                value={[
                  perfil.direccion,
                  perfil.localidad,
                  perfil.provincia,
                  perfil.pais,
                ]
                  .filter(Boolean)
                  .join(", ")}
              />
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

const InfoRow = ({
  icon: Icon,
  label,
  value,
}: {
  icon: any;
  label: string;
  value?: string | null;
}) => {
  if (!value) return null;

  return (
    <div className="flex items-start gap-3">
      <div className="w-8 h-8 bg-indigo-50 dark:bg-indigo-950/50 rounded-lg flex items-center justify-center shrink-0">
        <Icon className="w-4 h-4 text-indigo-500 dark:text-indigo-400" />
      </div>

      <div>
        <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide">
          {label}
        </p>

        <p className="text-sm font-semibold">{value}</p>
      </div>
    </div>
  );
};

export default StudentProfileModal;
