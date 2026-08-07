// Función de Supabase Edge que manda un mail cuando el chequeo automático
// de seguridad (ver supabase/migrations/20260807190000_..., función
// public.detectar_anomalias_seguridad(), programada con pg_cron) detecta
// algo raro — ráfagas de visitas o de registros de cuentas nuevas.
//
// La llama un trigger/función de Postgres, no el usuario desde el
// navegador, así que no tiene sentido pedirle un JWT (verify_jwt: false).
// El destino del mail está FIJO acá adentro (no lo manda quien llama), así
// que aunque alguien descubra la URL y le pegue directo, lo único que
// puede pasar es que llegue un mail falso a esa casilla — no hay forma de
// mandarlo a otro lado ni de leer nada sensible.
//
// Usa los mismos secrets de SMTP que "send-contact-email" y
// "send-welcome-email" (ya configurados en el proyecto):
//   SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import nodemailer from "npm:nodemailer@6.9.14";

const ALERT_TO_EMAIL = "plataformacapol@gmail.com";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { tipo, detalle, datos } = await req.json();
    if (!tipo || !detalle) {
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
      from: `"CapOL — Alertas de Seguridad" <${SMTP_USER}>`,
      to: ALERT_TO_EMAIL,
      subject: `🚨 Alerta de seguridad CapOL: ${tipo}`,
      html: `
        <h2>Se detectó una posible actividad anómala</h2>
        <p><strong>Tipo:</strong> ${tipo}</p>
        <p><strong>Detalle:</strong> ${detalle}</p>
        ${datos ? `<pre style="background:#f4f4f4;padding:12px;border-radius:8px;white-space:pre-wrap;">${JSON.stringify(datos, null, 2)}</pre>` : ""}
        <p style="color:#888;font-size:12px;">Revisá el detalle completo en el panel de administración, sección "Seguridad".</p>
      `,
    });

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Error en send-security-alert:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
