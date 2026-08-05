import { Award, Clock, CreditCard, GraduationCap, MessageCircle, type LucideIcon } from "lucide-react";

export interface FaqQuestion {
  id: string;
  pregunta: string;
  /** whitespace-pre-line al renderizar. "__DYNAMIC_COURSES__" es un sentinel que FaqBot resuelve con los cursos reales. */
  respuesta: string;
  relacionadas?: string[];
}

export interface FaqCategory {
  id: string;
  titulo: string;
  icono: LucideIcon;
  preguntas: FaqQuestion[];
}

export const DYNAMIC_COURSES_SENTINEL = "__DYNAMIC_COURSES__";

export const faqCategorias: FaqCategory[] = [
  {
    id: "cursos",
    titulo: "Cursos",
    icono: GraduationCap,
    preguntas: [
      {
        id: "cursos-disponibles",
        pregunta: "¿Qué cursos tienen disponibles?",
        respuesta: DYNAMIC_COURSES_SENTINEL,
      },
      {
        id: "cursos-nivel",
        pregunta: "¿Necesito conocimientos previos?",
        respuesta:
          "Depende del curso: cada uno indica su nivel (inicial, intermedio o avanzado) en su descripción. La mayoría de nuestros cursos están pensados para arrancar desde cero, sin requisitos previos.",
      },
      {
        id: "cursos-certificado",
        pregunta: "¿Los cursos tienen certificado?",
        respuesta:
          "Sí, todos nuestros cursos entregan un certificado digital al finalizar y cumplir con los requisitos del curso.",
        relacionadas: ["certificados-como-descargar"],
      },
    ],
  },
  {
    id: "inscripcion",
    titulo: "Inscripción y pagos",
    icono: CreditCard,
    preguntas: [
      {
        id: "inscripcion-como",
        pregunta: "¿Cómo me inscribo?",
        respuesta:
          "Elegí el curso que te interese desde la sección de cursos de esta página, hacé clic en \"Inscribirme\" y completá tus datos. Vas a recibir la confirmación por correo electrónico.",
      },
      {
        id: "inscripcion-medios-pago",
        pregunta: "¿Qué medios de pago aceptan?",
        respuesta:
          "Aceptamos tarjetas de crédito/débito y transferencia bancaria. Las opciones disponibles se muestran al momento de confirmar tu inscripción.",
      },
      {
        id: "inscripcion-cuotas",
        pregunta: "¿Puedo pagar en cuotas?",
        respuesta:
          "Sí, varios de nuestros cursos permiten abonarse en cuotas. La cantidad de cuotas disponibles se indica en la ficha de cada curso.",
      },
      {
        id: "inscripcion-reembolso",
        pregunta: "¿Hay devolución si me arrepiento?",
        respuesta:
          "Si todavía no accediste al contenido del curso, escribinos por WhatsApp dentro de las 48hs de la inscripción y te ayudamos con la devolución.",
      },
    ],
  },
  {
    id: "certificados",
    titulo: "Certificados",
    icono: Award,
    preguntas: [
      {
        id: "certificados-como-descargar",
        pregunta: "¿Cómo descargo mi certificado?",
        respuesta:
          "Una vez que cumplas los requisitos del curso, el certificado queda disponible para descargar desde tu panel de alumno, en la sección del curso correspondiente.",
      },
      {
        id: "certificados-requisito",
        pregunta: "¿Qué necesito para obtenerlo?",
        respuesta:
          "Generalmente hace falta completar las lecciones del curso y, en algunos casos, aprobar una evaluación final. Los requisitos específicos figuran en la descripción de cada curso.",
      },
    ],
  },
  {
    id: "horarios",
    titulo: "Horarios y modalidad",
    icono: Clock,
    preguntas: [
      {
        id: "horarios-en-vivo-vs-grabado",
        pregunta: "¿Cuál es la diferencia entre en vivo y grabado?",
        respuesta:
          "Los cursos \"en vivo\" tienen clases por videollamada en un horario fijo, con interacción directa con el profesor. Los cursos \"grabados\" tienen el contenido disponible para ver cuando quieras, a tu propio ritmo.",
      },
      {
        id: "horarios-perdi-clase",
        pregunta: "¿Qué pasa si falto a una clase en vivo?",
        respuesta:
          "No hay problema, las clases en vivo quedan grabadas y disponibles para que las veas cuando puedas.",
      },
      {
        id: "horarios-plataforma",
        pregunta: "¿Necesito instalar algo para las clases?",
        respuesta:
          "No, las clases en vivo se dan directamente desde el navegador, sin necesidad de instalar ninguna aplicación.",
      },
    ],
  },
  {
    id: "contacto",
    titulo: "Contacto y soporte",
    icono: MessageCircle,
    preguntas: [
      {
        id: "contacto-humano",
        pregunta: "Quiero hablar con una persona",
        respuesta: "Podés escribirnos por WhatsApp con el botón de abajo y te respondemos a la brevedad.",
      },
      {
        id: "contacto-horario-atencion",
        pregunta: "¿Cuál es el horario de atención?",
        respuesta: "Atendemos de lunes a viernes de 9 a 18hs. Fuera de ese horario, dejanos tu consulta y te respondemos al día siguiente.",
      },
    ],
  },
];
