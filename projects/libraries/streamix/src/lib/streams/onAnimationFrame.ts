import { createStream, Stream } from '../abstractions';

export function onAnimationFrame(): Stream<number> {
  return createStream<number>('onAnimationFrame', async function* (this: Stream<number>) {
    let lastFrameTime = performance.now();

    while (!this.completed()) {
      const currentTime = await new Promise<number>((resolve) =>
        requestAnimationFrame(resolve)
      );

      const elapsedTime = currentTime - lastFrameTime;
      lastFrameTime = currentTime;

      yield elapsedTime;
    }
  });
}
