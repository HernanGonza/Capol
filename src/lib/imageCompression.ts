// Comprime y convierte una imagen a WebP en el navegador antes de subirla,
// usando solo Canvas API (sin librerías externas). Reduce el peso de los
// flyers de curso de varios MB a unos cientos de KB, sin depender de que
// quien suba la imagen la optimice a mano.
export async function compressImageToWebP(file: File, maxWidth = 1600, quality = 0.82): Promise<File> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxWidth / bitmap.width);
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No se pudo procesar la imagen");
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("No se pudo comprimir la imagen"))),
      "image/webp",
      quality,
    );
  });

  // Si la compresión no logra achicar el archivo (raro, pasa con imágenes ya
  // muy chicas/simples), nos quedamos con el original en vez de "mejorar" a
  // algo más pesado.
  if (blob.size >= file.size) return file;

  const newName = file.name.replace(/\.[^.]+$/, "") + ".webp";
  return new File([blob], newName, { type: "image/webp" });
}
