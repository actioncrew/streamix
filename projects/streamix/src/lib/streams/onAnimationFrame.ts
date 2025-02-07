import { createEmission, createStream, Stream } from '../abstractions';

export function onAnimationFrame<T = number>(): Stream<T> {
  return createStream<T>('onAnimationFrame', async function* (this: Stream<T>) {
    let lastFrameTime = performance.now();

    while (!this.completed()) {
      const currentTime = await new Promise<number>((resolve) =>
        requestAnimationFrame(resolve)
      );

      const elapsedTime = currentTime - lastFrameTime;
      lastFrameTime = currentTime;

      yield createEmission({ value: elapsedTime });
    }
  });
}
