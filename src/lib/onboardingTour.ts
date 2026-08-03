import type { Database } from "@/integrations/supabase/types";

type AppRole = Database["public"]["Enums"]["app_role"];

// Un mensaje corto por rol para el paso de la barra lateral — no tiene
// sentido nombrar cada item uno por uno, alcanza con decir para qué sirve
// el conjunto (los items ya se explican solos con su ícono + etiqueta).
const sidebarCopyByRole: Record<AppRole, string> = {
  admin: "Gestión de cursos, alumnos, pagos, solicitudes, profesores y métricas: todo lo de la escuela vive acá.",
  teacher: "Tu panel con las clases que dictás y el acceso a mensajes con tus alumnos.",
  student: "Tus cursos, suscripciones y mensajes, todo a un clic de distancia.",
};

interface BuildStepsOptions {
  role: AppRole;
}

// Pasos del tour: solo apunta a elementos que están SIEMPRE en el DOM sin
// importar el estado de la sidebar (colapsada/expandida, mobile abierta),
// para no depender de navegar de página en página.
export const buildOnboardingSteps = ({ role }: BuildStepsOptions) => [
  {
    popover: {
      title: "¡Bienvenido a CapOL! 👋",
      description:
        "Te mostramos rápido las cosas más importantes de la plataforma. Podés cerrar este recorrido cuando quieras, pero te lo vamos a volver a mostrar la próxima vez que entres hasta que lo veas completo.",
    },
  },
  {
    element: "#tour-sidebar-nav",
    popover: {
      title: "Todos tus accesos directos",
      description: sidebarCopyByRole[role],
      side: "right" as const,
      align: "start" as const,
    },
  },
  {
    element: "#tour-notifications",
    popover: {
      title: "Notificaciones",
      description: "Acá te avisamos cuando hay actividad nueva en los foros de tus cursos.",
      side: "top" as const,
      align: "start" as const,
    },
  },
  {
    element: "#tour-theme-toggle",
    popover: {
      title: "Tema claro u oscuro",
      description: "Cambiá el look de la plataforma cuando quieras, se guarda para la próxima vez.",
      side: "top" as const,
      align: "start" as const,
    },
  },
  {
    element: "#tour-profile-avatar",
    popover: {
      title: "Tu perfil",
      description: "Tu foto, nombre y rol. Desde \"Mi Perfil\" podés editar tus datos cuando quieras.",
      side: "top" as const,
      align: "start" as const,
    },
  },
  {
    popover: {
      title: "¡Listo! 🎉",
      description: "Ya conocés lo esencial de CapOL. Podés volver a explorar todo con calma cuando quieras.",
    },
  },
];

interface StartTourOptions {
  role: AppRole;
  // Se llama SOLO si el usuario llega hasta el final y toca "Finalizar
  // Tour" — cerrarlo antes (X, Esc, click afuera) no cuenta como visto.
  onFinish: () => void;
  // Se llama siempre que el tour termina, sea por "Finalizar" o por cierre
  // manual — para restaurar cosas como la sidebar mobile que se haya
  // abierto solo para poder mostrar el tour.
  onEnd: () => void;
}

// driver.js (~15kb) y su CSS se cargan solo cuando el tour realmente se va a
// mostrar (usuarios que ya lo completaron nunca lo bajan) — mismo criterio
// que ya se usa acá para @react-pdf/renderer en certificate.tsx.
export const startOnboardingTour = async ({ role, onFinish, onEnd }: StartTourOptions) => {
  const [{ driver }] = await Promise.all([
    import("driver.js"),
    import("./onboardingTourStyles"),
  ]);

  const driverObj = driver({
    showProgress: true,
    progressText: "{{current}} de {{total}}",
    nextBtnText: "Siguiente",
    prevBtnText: "Anterior",
    doneBtnText: "Finalizar Tour",
    animate: true,
    smoothScroll: true,
    stagePadding: 6,
    stageRadius: 12,
    overlayOpacity: 0.65,
    disableActiveInteraction: true,
    skipMissingElement: true,
    steps: buildOnboardingSteps({ role }),
    onDoneClick: () => {
      onFinish();
      driverObj.destroy();
    },
    onDestroyed: () => {
      onEnd();
    },
  });

  driverObj.drive();
  return driverObj;
};
