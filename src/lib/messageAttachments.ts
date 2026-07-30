import { supabase } from "@/integrations/supabase/client";

export const MAX_ATTACHMENT_SIZE = 20 * 1024 * 1024; // 20MB
export const ACCEPTED_ATTACHMENT_TYPES =
  ".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip,.rar,.png,.jpg,.jpeg,.gif,.webp";

// El path se arma como "<mensaje_id>/<archivo>": la policy de storage valida
// el acceso haciendo join contra la fila de "mensajes" con ese mismo id, así
// que el id del mensaje se genera ANTES de subir el archivo y se reusa como
// id explícito al insertar la fila.
export const uploadMessageAttachment = async (messageId: string, file: File) => {
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `${messageId}/${safeName}`;
  const { error } = await supabase.storage.from("mensajes-adjuntos").upload(path, file);
  if (error) throw error;
  return path;
};

// El bucket es privado: cada apertura genera una URL firmada nueva (más
// simple que mantener URLs cacheadas, y evita servir un link vencido).
export const openMessageAttachment = async (path: string) => {
  const tab = window.open("", "_blank");
  try {
    const { data, error } = await supabase.storage.from("mensajes-adjuntos").createSignedUrl(path, 3600);
    if (error) throw error;
    if (tab) tab.location.href = data.signedUrl;
    return true;
  } catch (e) {
    tab?.close();
    throw e;
  }
};
