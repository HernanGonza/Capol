// Función de Supabase Edge que envía un mail cuando alguien completa el
// formulario de contacto de la Landing. Usa Nodemailer (SMTP), no un
// servicio de terceros tipo Resend: se conecta directo al servidor SMTP
// que le indiques.
//
// Requiere que estén configurados estos secrets en el proyecto de Supabase
// (Supabase Dashboard -> Edge Functions -> Manage secrets, o vía CLI con
// `supabase secrets set`):
//
//   SMTP_HOST      -> ej: smtp.gmail.com, smtp.office365.com, mail.tudominio.com
//   SMTP_PORT      -> ej: 465 (SSL) o 587 (STARTTLS)
//   SMTP_SECURE    -> "true" si el puerto es 465, "false" si es 587
//   SMTP_USER      -> usuario/casilla que envía el mail
//   SMTP_PASS      -> contraseña (si es Gmail, tiene que ser una "contraseña
//                     de aplicación", no la contraseña normal de la cuenta)
//   CONTACT_TO_EMAIL   -> a qué dirección llegan los mensajes del formulario
//   CONTACT_FROM_NAME  -> (opcional) nombre que se muestra como remitente, ej "CAPOL"

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import nodemailer from "npm:nodemailer@6.9.14";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { nombre, email, mensaje } = await req.json();

    if (!nombre || !email || !mensaje) {
      return new Response(JSON.stringify({ error: "Faltan datos" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const SMTP_HOST = Deno.env.get("SMTP_HOST");
    const SMTP_PORT = Deno.env.get("SMTP_PORT");
    const SMTP_SECURE = Deno.env.get("SMTP_SECURE") === "true";
    const SMTP_USER = Deno.env.get("SMTP_USER");
    const SMTP_PASS = Deno.env.get("SMTP_PASS");
    const CONTACT_TO_EMAIL = Deno.env.get("CONTACT_TO_EMAIL");
    const CONTACT_FROM_NAME = Deno.env.get("CONTACT_FROM_NAME") || "CAPOL";

    if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS || !CONTACT_TO_EMAIL) {
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
      to: CONTACT_TO_EMAIL,
      replyTo: email,
      subject: `Nuevo mensaje de contacto de ${nombre} — CAPOL`,
      html: `
        <h2>Nuevo mensaje desde el formulario de contacto</h2>
        <p><strong>Nombre:</strong> ${nombre}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Mensaje:</strong></p>
        <p>${String(mensaje).replace(/\n/g, "<br>")}</p>
      `,
    });

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Error en send-contact-email:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});