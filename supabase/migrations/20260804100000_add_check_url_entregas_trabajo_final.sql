-- Defensa extra contra XSS vía "javascript:" en el link de entrega de un
-- trabajo final: el formulario del alumno ya valida que empiece con
-- http(s), pero esa validación es solo del lado del cliente y se puede
-- evitar llamando a la API de Supabase directo (la RLS igual le permite
-- escribir su propia fila). Este constraint lo bloquea también a nivel de
-- base — sin esto, un link malicioso guardado ahí se ejecutaría en el
-- navegador del PROFESOR cuando revisa las entregas y hace click para
-- abrirlo (ver src/components/RevisarEntregasDialog.tsx).
alter table public.entregas_trabajo_final
  add constraint entregas_trabajo_final_url_http_check
  check (tipo <> 'link' or url ~ '^https?://');
