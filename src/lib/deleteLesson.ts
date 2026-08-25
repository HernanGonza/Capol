import { supabase } from "@/integrations/supabase/client";

export type DeleteLessonResult = {
  lessonResourcesDeleted: number;
  submissionFilesDeleted: number;
};

const storagePathFromUrl = (value: string, bucket: string) => {
  try {
    const pathname = new URL(value).pathname;
    const markers = [
      `/storage/v1/object/public/${bucket}/`,
      `/storage/v1/object/sign/${bucket}/`,
      `/storage/v1/object/${bucket}/`,
    ];
    const marker = markers.find((candidate) => pathname.includes(candidate));
    if (!marker) return null;
    return decodeURIComponent(pathname.slice(pathname.indexOf(marker) + marker.length));
  } catch {
    return null;
  }
};

const collectStrings = (value: unknown, result: string[]) => {
  if (typeof value === "string") {
    result.push(value);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item) => collectStrings(item, result));
    return;
  }
  if (value && typeof value === "object") {
    Object.values(value).forEach((item) => collectStrings(item, result));
  }
};

const lessonResourcePaths = (content: string | null) => {
  const strings: string[] = [];
  try {
    collectStrings(JSON.parse(content || "[]"), strings);
  } catch {
    strings.push(content || "");
  }

  return [...new Set(
    strings
      .flatMap((value) => value.match(/https?:\/\/[^\s"'<>]+/g) || [value])
      .map((value) => storagePathFromUrl(value, "lesson-resources"))
      .filter((path): path is string => Boolean(path))
  )];
};

const removeStorageObjects = async (bucket: string, paths: string[]) => {
  if (paths.length === 0) return;
  const { error } = await supabase.storage.from(bucket).remove(paths);
  if (error) throw new Error(`No se pudieron eliminar los archivos de ${bucket}: ${error.message}`);
};

// Limpia primero los objetos físicos mediante Storage API y luego elimina la
// clase. Las FK de Postgres eliminan en cascada ejercicios, progreso y entregas.
// La fila devuelta por DELETE evita informar éxito cuando RLS borró 0 registros.
export const deleteLessonCompletely = async (lessonId: string): Promise<DeleteLessonResult> => {
  const { data: lesson, error: lessonError } = await supabase
    .from("lecciones")
    .select("id, content")
    .eq("id", lessonId)
    .single();

  if (lessonError || !lesson) {
    throw new Error(lessonError?.message || "La clase no existe o no tenés permiso para eliminarla.");
  }

  const { data: submissions, error: submissionsError } = await supabase
    .from("entregas_trabajo_final")
    .select("tipo, url")
    .eq("leccion_id", lessonId);

  if (submissionsError) throw submissionsError;

  const resourcePaths = lessonResourcePaths(lesson.content);
  const submissionPaths = [...new Set(
    (submissions || [])
      .filter((submission) => submission.tipo === "archivo" && submission.url)
      .map((submission) => submission.url)
  )];

  await removeStorageObjects("lesson-resources", resourcePaths);
  await removeStorageObjects("trabajos-finales", submissionPaths);

  const { data: deleted, error: deleteError } = await supabase
    .from("lecciones")
    .delete()
    .eq("id", lessonId)
    .select("id");

  if (deleteError) throw deleteError;
  if (deleted?.length !== 1) {
    throw new Error("Supabase no eliminó la clase. Verificá que siga asignada a este curso.");
  }

  return {
    lessonResourcesDeleted: resourcePaths.length,
    submissionFilesDeleted: submissionPaths.length,
  };
};
