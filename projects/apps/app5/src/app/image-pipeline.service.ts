// services/image-pipeline.service.ts
import {
  cascade,
  Coroutine,
  coroutine,
  createSubject,
  filter,
  fromPromise,
  map,
  Stream,
  switchMap,
  tap,
} from '@actioncrew/streamix';
import { Injectable, NgZone } from '@angular/core';

import { compressImage, CompressInput, CompressOutput, FileTask, ProcessedResult, resizeImage, ResizeInput, ResizeOutput } from './image-processing.utils';

@Injectable({ providedIn: 'root' })
export class ImagePipelineService {
  private resizeCoroutine: Coroutine<ResizeInput, ResizeOutput>;
  private compressCoroutine: Coroutine<CompressInput, CompressOutput>;

  private fileStream = createSubject<FileTask>();
  private progressStream = createSubject<{ id: string; progress: any }>();

  readonly resultStream: Stream<ProcessedResult>;

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

    this.resizeCoroutine = coroutine({ customMessageHandler })(resizeImage);
    this.compressCoroutine = coroutine({ customMessageHandler })(compressImage);

    this.resultStream = this.fileStream.pipe(
      filter((task) => task.file.type.startsWith('image/')),
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
      cascade(this.resizeCoroutine, this.compressCoroutine),
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
      }),
      tap((result) => this.ngZone.run(() => this.emitResult(result)))
    );
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
