// Función de Supabase Edge que le manda al alumno un mail cuando pasa algo
// con su cuenta que le conviene saber al toque:
//
//   - "solicitud_aprobada"      -> su solicitud de inscripción fue aceptada
//   - "suscripcion_habilitada"  -> se registró el pago y ya tiene acceso al curso
//   - "suscripcion_diferida"    -> se le habilitó el acceso con pago diferido
//
// La disparan triggers de base de datos vía pg_net (ver la migración
// 20260901xxxxxx_notificaciones_alumno.sql), NO el cliente — así el mail
// llega sin depender del navegador desde el que se registró el pago.
//
// Como la llama un trigger de Postgres, no tiene sentido pedirle el JWT del
// usuario (verify_jwt: false). En su lugar la función arma su propio cliente
// admin con SUPABASE_SERVICE_ROLE_KEY y vuelve a verificar ella misma, contra
// la base, que:
//   1. el usuario existe y tiene un mail,
//   2. el evento que se le pide notificar es real (hay una suscripción
//      con acceso / una solicitud aprobada para ese alumno y curso).
// Así el endpoint no sirve para mandar mails arbitrarios: en el peor caso
// re-manda una notificación legítima a la casilla real de ese alumno.
//
// Usa los mismos secrets de SMTP que "send-welcome-email" (ya configurados):
//   SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS
//   CONTACT_FROM_NAME (opcional, nombre del remitente)

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import nodemailer from "npm:nodemailer@6.9.14";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SITE_URL = "https://www.capolescuela.com";

type Tipo = "solicitud_aprobada" | "suscripcion_habilitada" | "suscripcion_diferida";

const esc = (s: string) =>
  (s || "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string)
  );

// Envoltorio con el mismo formato que los mails de Supabase (confirmación /
// bienvenida): fondo oscuro, card con encabezado en degradé indigo, logo.
const wrap = (titulo: string, cuerpoHtml: string) => `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${esc(titulo)}</title>
</head>
<body style="margin:0;padding:0;background-color:#0a0a0f;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#0a0a0f;min-height:100vh;">
    <tr>
      <td align="center" style="padding:48px 16px;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;">
          <tr>
            <td align="center" style="padding-bottom:28px;">
              <table cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="vertical-align:middle;padding-right:10px;">
                    <img src="https://jpzicnrimbsqxjezehdf.supabase.co/storage/v1/object/public/branding/logo-capol.png" width="40" height="40" alt="CapOL" border="0" style="width:40px;height:40px;border-radius:50%;display:block;object-fit:cover;" />
                  </td>
                  <td style="vertical-align:middle;">
                    <div style="color:#ffffff;font-size:18px;font-weight:900;letter-spacing:-0.5px;line-height:1;">CapOL</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.08);border-radius:24px;overflow:hidden;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="background:linear-gradient(135deg,#6366f1 0%,#8b5cf6 100%);padding:32px 40px;text-align:center;">
                    <h1 style="color:#ffffff;font-size:22px;font-weight:800;margin:0;letter-spacing:-0.3px;line-height:1.2;">
                      ${esc(titulo)}
                    </h1>
                  </td>
                </tr>
              </table>
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="padding:32px 40px;">
                    ${cuerpoHtml}
                    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 20px;">
                      <tr><td style="border-top:1px solid rgba(255,255,255,0.08);"></td></tr>
                    </table>
                    <p style="color:rgba(255,255,255,0.35);font-size:13px;line-height:1.6;margin:0;">
                      Cualquier duda podés respondernos por la mensajería de la plataforma o por WhatsApp.<br />
                      Atte.<br />Equipo de CapOL Escuela
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding-top:24px;">
              <p style="color:rgba(255,255,255,0.2);font-size:12px;margin:0;">CapOL Escuela Virtual</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

const boton = (href: string, texto: string) => `
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:24px;">
  <tr>
    <td align="center">
      <a href="${href}" style="display:inline-block;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;padding:14px 40px;border-radius:12px;letter-spacing:0.2px;">
        ${esc(texto)}
      </a>
    </td>
  </tr>
</table>
`;

const parrafo = (html: string) =>
  `<p style="color:rgba(255,255,255,0.65);font-size:15px;line-height:1.7;margin:0 0 20px;">${html}</p>`;

const fmtFecha = (iso: string | null) => {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleDateString("es-AR", { day: "numeric", month: "long", year: "numeric" });
  } catch {
    return null;
  }
};

interface Contenido {
  subject: string;
  html: string;
}

const construirMail = (
  tipo: Tipo,
  opts: { nombre: string; cursoTitulo: string; cursoId: string; fechaLimite: string | null }
): Contenido => {
  const hola = opts.nombre ? `Hola ${esc(opts.nombre)},` : "Hola,";
  const curso = `«${esc(opts.cursoTitulo)}»`;
  const urlCurso = `${SITE_URL}/course/${opts.cursoId}`;
  const urlDashboard = `${SITE_URL}/dashboard`;

  if (tipo === "solicitud_aprobada") {
    return {
      subject: `Tu solicitud para ${opts.cursoTitulo} fue aceptada`,
      html: wrap(
        "Solicitud aceptada",
        parrafo(`${hola} tu solicitud de inscripción al curso ${curso} fue <strong>aceptada</strong>. 🎉`) +
          parrafo(
            "Nos vamos a poner en contacto con vos para coordinar el pago. Apenas quede registrado, te habilitamos el acceso al curso."
          ) +
          boton(urlDashboard, "Ir a la plataforma")
      ),
    };
  }

  if (tipo === "suscripcion_diferida") {
    const fecha = fmtFecha(opts.fechaLimite);
    return {
      subject: `Tu acceso a ${opts.cursoTitulo} ya está habilitado`,
      html: wrap(
        "Acceso habilitado",
        parrafo(`${hola} te habilitamos el acceso al curso ${curso} con <strong>pago diferido</strong>. Ya podés entrar a las clases. 🎓`) +
          (fecha
            ? parrafo(
                `Recordá que te comprometiste a completar el pago antes del <strong>${esc(fecha)}</strong>.`
              )
            : "") +
          boton(urlCurso, "Entrar al curso")
      ),
    };
  }

  // suscripcion_habilitada
  return {
    subject: `Tu acceso a ${opts.cursoTitulo} ya está activo`,
    html: wrap(
      "Suscripción habilitada",
      parrafo(`${hola} registramos tu pago y tu acceso al curso ${curso} <strong>ya está activo</strong>. 🎓`) +
        parrafo("Podés entrar a las clases cuando quieras desde «Mis Cursos».") +
        boton(urlCurso, "Entrar al curso")
    ),
  };
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { tipo, usuario_id, curso_id } = await req.json();

    const tiposValidos: Tipo[] = ["solicitud_aprobada", "suscripcion_habilitada", "suscripcion_diferida"];
    if (!tiposValidos.includes(tipo) || !usuario_id || !curso_id) {
      return new Response(JSON.stringify({ error: "Datos inválidos" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // 1. El usuario existe y tiene mail.
    const { data: userData, error: userError } = await admin.auth.admin.getUserById(usuario_id);
    if (userError || !userData?.user?.email) {
      return new Response(JSON.stringify({ error: "Usuario no encontrado" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const email = userData.user.email;

    // 2. El evento es real (no confiamos en el caller).
    let fechaLimite: string | null = null;
    if (tipo === "solicitud_aprobada") {
      const { data: sol } = await admin
        .from("solicitudes_inscripcion")
        .select("id")
        .eq("usuario_id", usuario_id)
        .eq("curso_id", curso_id)
        .eq("estado", "aprobada")
        .maybeSingle();
      if (!sol) {
        return new Response(JSON.stringify({ error: "No hay una solicitud aprobada para ese alumno y curso" }), {
          status: 409,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } else {
      const { data: sub } = await admin
        .from("suscripciones")
        .select("estado, pago_diferido_hasta")
        .eq("usuario_id", usuario_id)
        .eq("curso_id", curso_id)
        .in("estado", ["active", "pago_diferido"])
        .order("creado_en", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!sub) {
        return new Response(JSON.stringify({ error: "No hay una suscripción con acceso para ese alumno y curso" }), {
          status: 409,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      fechaLimite = sub.pago_diferido_hasta ?? null;
    }

    const { data: perfil } = await admin
      .from("perfiles")
      .select("nombre_completo")
      .eq("id", usuario_id)
      .maybeSingle();
    const nombre = (perfil?.nombre_completo || "").trim().split(" ")[0] || "";

    const { data: curso } = await admin
      .from("cursos")
      .select("titulo")
      .eq("id", curso_id)
      .maybeSingle();
    const cursoTitulo = curso?.titulo || "tu curso";

    const SMTP_HOST = Deno.env.get("SMTP_HOST");
    const SMTP_PORT = Deno.env.get("SMTP_PORT");
    const SMTP_SECURE = Deno.env.get("SMTP_SECURE") === "true";
    const SMTP_USER = Deno.env.get("SMTP_USER");
    const SMTP_PASS = Deno.env.get("SMTP_PASS");
    const CONTACT_FROM_NAME = Deno.env.get("CONTACT_FROM_NAME") || "CapOL";

    if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS) {
      return new Response(
        JSON.stringify({ error: "El envío de mail no está configurado todavía (faltan secrets de SMTP)." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { subject, html } = construirMail(tipo, { nombre, cursoTitulo, cursoId: curso_id, fechaLimite });

    const transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: Number(SMTP_PORT),
      secure: SMTP_SECURE,
      auth: { user: SMTP_USER, pass: SMTP_PASS },
    });

    await transporter.sendMail({
      from: `"${CONTACT_FROM_NAME}" <${SMTP_USER}>`,
      to: email,
      subject,
      html,
    });

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Error en send-account-notification:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
