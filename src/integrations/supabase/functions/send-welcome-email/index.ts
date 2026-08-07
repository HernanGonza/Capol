// Función de Supabase Edge que manda el mail de bienvenida cuando un
// usuario confirma su cuenta (email_confirmed_at pasa de null a una
// fecha). La dispara un trigger de base de datos en auth.users (ver
// supabase/migrations/20260807150000_add_welcome_email_trigger.sql), no el
// cliente — así llega sin importar desde qué dispositivo/navegador se haya
// confirmado el mail.
//
// Como la llama un trigger de Postgres (no el usuario desde el navegador),
// no tiene sentido pedirle el JWT del propio usuario (verify_jwt: false).
// En su lugar, la función arma su propio cliente admin con
// SUPABASE_SERVICE_ROLE_KEY (variable que Supabase ya inyecta sola en todo
// Edge Function, no hace falta configurarla a mano) y vuelve a consultar
// ella misma si ese usuario existe y realmente tiene el mail confirmado
// antes de mandar nada — así el endpoint no puede usarse para mandar mails
// arbitrarios a direcciones arbitrarias, solo puede reenviarle la
// bienvenida a una cuenta real que ya se confirmó.
//
// Usa los mismos secrets de SMTP que "send-contact-email" (ya configurados
// en el proyecto):
//   SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS
//   CONTACT_FROM_NAME (opcional, nombre del remitente)

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import nodemailer from "npm:nodemailer@6.9.14";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const WELCOME_HTML = (nombre: string) => `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>¡Bienvenido/a a CapOL!</title>
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
                      ¡Bienvenido/a a CapOL! 🎉
                    </h1>
                  </td>
                </tr>
              </table>
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="padding:32px 40px;">
                    <p style="color:rgba(255,255,255,0.65);font-size:15px;line-height:1.7;margin:0 0 20px;">
                      Buenos días, esperamos que se encuentre muy bien 🤙
                    </p>
                    <p style="color:rgba(255,255,255,0.65);font-size:15px;line-height:1.7;margin:0 0 20px;">
                      Le damos la bienvenida a la comunidad de alumnos de Escuela CapOL${nombre ? `, ${nombre}` : ""} — su cuenta ya quedó confirmada y activa 👩🏽‍💻👩‍💻👩🏻‍💻👩🏼‍💻👨🏻‍💻👨🏼‍💻👨🏽‍💻👨‍💻
                    </p>
                    <p style="color:rgba(255,255,255,0.65);font-size:15px;line-height:1.7;margin:0 0 28px;">
                      Para inscribirse a un curso, ingrese a la plataforma y haga clic en el botón "Inscribirme" (o "Comprar", si es un curso grabado) de la tarjeta del curso que desea, y luego en "Confirmar solicitud de inscripción" ✍️
                    </p>
                    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:28px;">
                      <tr>
                        <td align="center">
                          <a href="https://www.capolescuela.com/dashboard"
                             style="display:inline-block;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;padding:14px 40px;border-radius:12px;letter-spacing:0.2px;">
                            Ver cursos disponibles
                          </a>
                        </td>
                      </tr>
                    </table>
                    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:20px;">
                      <tr><td style="border-top:1px solid rgba(255,255,255,0.08);"></td></tr>
                    </table>
                    <p style="color:rgba(255,255,255,0.5);font-size:13px;line-height:1.7;margin:0 0 20px;">
                      Cualquier duda nos puede consultar por este medio o por WhatsApp usando el botón de la web o nuestra fan page de Facebook 📲
                    </p>
                    <p style="color:rgba(255,255,255,0.35);font-size:13px;line-height:1.6;margin:0;">
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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { user_id } = await req.json();
    if (!user_id) {
      return new Response(JSON.stringify({ error: "Falta user_id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Re-verificamos acá adentro (con la service role, no confiamos en el
    // caller) que el usuario existe y de verdad tiene el mail confirmado.
    const { data: userData, error: userError } = await admin.auth.admin.getUserById(user_id);
    if (userError || !userData?.user?.email || !userData.user.email_confirmed_at) {
      return new Response(JSON.stringify({ error: "Usuario no encontrado o mail sin confirmar" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const email = userData.user.email;
    const { data: perfil } = await admin.from("perfiles").select("nombre_completo").eq("id", user_id).maybeSingle();
    const nombre = (perfil?.nombre_completo || "").trim().split(" ")[0] || "";

    const SMTP_HOST = Deno.env.get("SMTP_HOST");
    const SMTP_PORT = Deno.env.get("SMTP_PORT");
    const SMTP_SECURE = Deno.env.get("SMTP_SECURE") === "true";
    const SMTP_USER = Deno.env.get("SMTP_USER");
    const SMTP_PASS = Deno.env.get("SMTP_PASS");
    const CONTACT_FROM_NAME = Deno.env.get("CONTACT_FROM_NAME") || "CapOL";

    if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS) {
      return new Response(
        JSON.stringify({ error: "El envío de mail no está configurado todavía (faltan secrets de SMTP)." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: Number(SMTP_PORT),
      secure: SMTP_SECURE,
      auth: { user: SMTP_USER, pass: SMTP_PASS },
    });

    await transporter.sendMail({
      from: `"${CONTACT_FROM_NAME}" <${SMTP_USER}>`,
      to: email,
      subject: "¡Bienvenido/a a CapOL! 🎉",
      html: WELCOME_HTML(nombre),
    });

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Error en send-welcome-email:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
