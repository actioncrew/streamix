// services/image-pipeline.service.ts
import {
  compose,
  Coroutine,
  coroutine,
  createSubject,
  filter,
  fromPromise,
  map,
  seize,
  Stream,
  switchMap,
  throttle,
} from '@actioncrew/streamix';
import { Injectable, NgZone } from '@angular/core';

import { compressImage, resizeImage } from './image-processing.utils';

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

interface ResizeInput {
  blob: ArrayBuffer;
  width: number;
  height: number;
  taskId?: string;
  originalSize?: number;
}

interface ResizeOutput extends ResizeInput {
  blob: ArrayBuffer;
  size: number;
}

interface CompressInput extends ResizeOutput {
  quality: number;
}

interface CompressOutput extends CompressInput {
  finalBlob: ArrayBuffer;
  compressedSize: number;
}

// Wrapper coroutine factory to merge input + output

function createResizeCoroutine(
  customMessageHandler: any
): Coroutine<ResizeInput, ResizeOutput> {
  const base = coroutine({ customMessageHandler })(resizeImage);
  return {
    ...base,
    processTask: async (input: ResizeInput): Promise<ResizeOutput> => {
      const output = await base.processTask(input);
      return {
        ...input,  // keep all input props (taskId, originalSize, etc)
        ...output, // add blob and size from resizeImage output
      };
    }
  } as Coroutine<ResizeInput, ResizeOutput>;
}

function createCompressCoroutine(
  customMessageHandler: any
): Coroutine<CompressInput, CompressOutput> { // note output type

  const base = coroutine({ customMessageHandler })(compressImage);

  return {
    ...base,
    processTask: async (input: CompressInput): Promise<CompressOutput> => {
      const output = await base.processTask(input);
      return { ...input, ...output };
    }
  } as any;
}

@Injectable({ providedIn: 'root' })
export class ImagePipelineService {
  private resizeCoroutine: Coroutine<ResizeInput, ResizeOutput>;
  private compressCoroutine: Coroutine<CompressInput, CompressOutput>;

  private fileStream = createSubject<FileTask>();
  private progressStream = createSubject<{ id: string; progress: any }>();

  readonly resultStream: Stream<ProcessedResult>;
  readonly previewWorkerStream: Stream<any>;

  constructor(private ngZone: NgZone) {
    const customMessageHandler = (
      event: MessageEvent,
      _worker: Worker,
      pendingMessages: Map<
        string,
        { resolve: (v: any) => void; reject: (e: Error) => void }
      >
    ) => {
      const { taskId, payload, type, error } = event.data;

      if (type === 'progress') {
        this.ngZone.run(() => {
          this.progressStream.next({ id: taskId, progress: payload });
        });
        return;
      }

      const pending = pendingMessages.get(taskId);
      if (!pending) return;

      if (type === 'response') {
        pendingMessages.delete(taskId);
        pending.resolve(payload);
      } else if (type === 'error') {
        pendingMessages.delete(taskId);
        pending.reject(new Error(error ?? 'Unknown worker error'));
      }
    };

    this.resizeCoroutine = createResizeCoroutine(customMessageHandler);
    this.compressCoroutine = createCompressCoroutine(customMessageHandler);

    this.previewWorkerStream = seize(
      this.resizeCoroutine,
      (msg) => {
        if (msg.type === 'progress') {
          this.progressStream.next({ id: 'preview', progress: msg.payload });
        }
      },
      (err) => console.error('Preview worker error:', err)
    );

    this.resultStream = this.fileStream.pipe(
      filter((task) => task.file.type.startsWith('image/')),
      throttle(1),
      switchMap((task) =>
        fromPromise(task.file.arrayBuffer()).pipe(
          map((arrayBuffer) => ({
            blob: arrayBuffer,
            width: 800,
            height: 600,
            taskId: task.id,
            originalSize: task.file.size,
            quality: 0.7, // add default quality here for compress input
          }))
        )
      ),
      compose(this.resizeCoroutine, this.compressCoroutine),
      map((result) => {
        const finalBlob = new Blob([result.finalBlob], { type: 'image/jpeg' });
        const url = URL.createObjectURL(finalBlob);

        return {
          id: result.taskId!,
          url,
          originalSize: result.originalSize!,
          finalSize: result.compressedSize,
          saved: result.originalSize! - result.compressedSize,
        };
      })
    );

    this.resultStream.subscribe((result) => {
      this.ngZone.run(() => this.emitResult(result));
    });
  }

  uploadFile(file: File) {
    this.fileStream.next({ file, id: crypto.randomUUID() });
  }

  private emitResult(result: ProcessedResult) {
    console.log('Processed:', result);
  }

  ngOnDestroy() {
    this.resizeCoroutine.finalize();
    this.compressCoroutine.finalize();
    this.fileStream.complete();
    this.progressStream.complete();
  }
}
