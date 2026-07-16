/** Canvas-side crop for avatar uploads (react-easy-crop hands us pixel coords). */

export type CropArea = { x: number; y: number; width: number; height: number };

const OUTPUT_SIZE = 512; // matches the server's avatar size — its center-crop becomes a no-op

/**
 * Draw the selected region of `imageSrc` onto a 512×512 canvas and return it as a
 * Blob. Exports JPEG (Safari silently falls back to PNG on webp encode; the server
 * re-encodes to WebP anyway) with a PNG fallback if JPEG encoding fails. Browsers
 * apply EXIF orientation when decoding into an <img>, and react-easy-crop measures
 * against that oriented image, so the coordinates always match what the user saw.
 */
export async function getCroppedAvatar(imageSrc: string, area: CropArea): Promise<Blob> {
  const img = new Image();
  img.src = imageSrc;
  await img.decode();

  const canvas = document.createElement("canvas");
  canvas.width = OUTPUT_SIZE;
  canvas.height = OUTPUT_SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not process the image in this browser.");

  ctx.drawImage(
    img,
    area.x,
    area.y,
    area.width,
    area.height,
    0,
    0,
    OUTPUT_SIZE,
    OUTPUT_SIZE
  );

  const toBlob = (type: string, quality?: number) =>
    new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));

  const blob = (await toBlob("image/jpeg", 0.9)) ?? (await toBlob("image/png"));
  if (!blob) throw new Error("Could not encode the cropped image.");
  return blob;
}
