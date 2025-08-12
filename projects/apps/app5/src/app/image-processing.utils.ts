// utils/image-processing.utils.ts

/**
 * Resizes an image using OffscreenCanvas, which can run in a Web Worker.
 * @param data The image blob and target dimensions.
 * @param utils Helper functions provided by the coroutine worker environment.
 * @returns A promise that resolves with the resized image blob as an ArrayBuffer.
 */
export async function resizeImage(
  data: { blob: ArrayBuffer; width: number; height: number },
  utils: { reportProgress: (p: any) => void }
): Promise<{ blob: ArrayBuffer; size: number }> {
  utils.reportProgress({ stage: 'resize', progress: 0 });

  const { blob, width, height } = data;
  const imageBitmap = await createImageBitmap(new Blob([blob]));

  const offscreenCanvas = new OffscreenCanvas(width, height);
  const ctx = offscreenCanvas.getContext('2d');

  if (!ctx) {
    throw new Error("Could not get 2D context from OffscreenCanvas.");
  }

  // Draw the image onto the OffscreenCanvas
  ctx.drawImage(imageBitmap, 0, 0, width, height);

  utils.reportProgress({ stage: 'resize', progress: 0.5 });

  // Convert the canvas content to a blob
  const outputBlob = await offscreenCanvas.convertToBlob({ type: 'image/jpeg', quality: 0.8 });

  // Clean up the image bitmap
  imageBitmap.close();

  utils.reportProgress({ stage: 'resize', progress: 1.0 });

  return {
    blob: await outputBlob.arrayBuffer(),
    size: outputBlob.size,
  };
}

/**
 * Compresses an image using OffscreenCanvas, which can run in a Web Worker.
 * @param data The image blob and compression quality.
 * @param utils Helper functions provided by the coroutine worker environment.
 * @returns A promise that resolves with the compressed image blob as an ArrayBuffer.
 */
export async function compressImage(
  data: { blob: ArrayBuffer; },
  utils: { reportProgress: (p: any) => void }
): Promise<{ finalBlob: ArrayBuffer; compressedSize: number }> {
  utils.reportProgress({ stage: 'compress', progress: 0 });

  const { blob } = data;
  const quality = 0.7;
  const imageBitmap = await createImageBitmap(new Blob([blob]));

  const offscreenCanvas = new OffscreenCanvas(imageBitmap.width, imageBitmap.height);
  const ctx = offscreenCanvas.getContext('2d');

  if (!ctx) {
    throw new Error("Could not get 2D context from OffscreenCanvas.");
  }

  ctx.drawImage(imageBitmap, 0, 0);

  utils.reportProgress({ stage: 'compress', progress: 0.5 });

  const outputBlob = await offscreenCanvas.convertToBlob({ type: 'image/jpeg', quality });

  imageBitmap.close();

  utils.reportProgress({ stage: 'compress', progress: 1.0 });

  return {
    finalBlob: await outputBlob.arrayBuffer(),
    compressedSize: outputBlob.size,
  };
}
