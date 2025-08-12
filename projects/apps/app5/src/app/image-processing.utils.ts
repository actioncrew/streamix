// utils/image-processing.utils.ts

export interface FileTask {
  file: File;
  id: string;
}

export interface ProcessedResult {
  id: string;
  url: string;
  originalSize: number;
  finalSize: number;
  saved: number;
}

export interface ResizeInput {
  blob: ArrayBuffer;
  width: number;
  height: number;
  taskId?: string;
  originalSize?: number;
}

export interface ResizeOutput extends ResizeInput {
  blob: ArrayBuffer;
  size: number;
}

export interface CompressInput extends ResizeOutput {
  quality: number;
}

export interface CompressOutput extends CompressInput {
  finalBlob: ArrayBuffer;
  compressedSize: number;
}

/**
 * Resizes an image using OffscreenCanvas, which can run in a Web Worker.
 * @param data The image blob and target dimensions.
 * @param utils Helper functions provided by the coroutine worker environment.
 * @returns A promise that resolves with the resized image blob as an ArrayBuffer.
 */
export async function resizeImage(
  data: ResizeInput,
  utils: { reportProgress: (p: any) => void }
): Promise<ResizeOutput> {
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
    ...data,
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
  data: CompressInput,
  utils: { reportProgress: (p: any) => void }
): Promise<CompressOutput> {
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
    ...data,
    finalBlob: await outputBlob.arrayBuffer(),
    compressedSize: outputBlob.size,
  };
}
