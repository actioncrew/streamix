import { createEmission, createStream, Stream } from '../abstractions';

/**
 * Creates a Stream from `window.matchMedia` for reactive media query handling.
 *
 * @param mediaQueryString - The media query string to observe.
 * @returns A Stream that emits boolean values when media query matches change.
 */
export function onMediaQuery(mediaQueryString: string): Stream<boolean> {
  return createStream<boolean>('onMediaQuery', async function* (this: Stream<boolean>) {
    if (!window.matchMedia) {
      console.warn('matchMedia is not supported in this environment');
      return;
    }

    const mediaQueryList = window.matchMedia(mediaQueryString);
    const queue: boolean[] = [mediaQueryList.matches]; // Initial state
    let completed = false;

    // Event listener for media query changes
    const listener = (event: MediaQueryListEvent) => queue.push(event.matches);
    mediaQueryList.addEventListener('change', listener);

    try {
      // Yield values from the queue as they become available
      while (!completed || queue.length > 0) {
        if (queue.length > 0) {
          yield createEmission({ value: queue.shift()! });
        } else {
          await new Promise(requestAnimationFrame);
        }
      }
    } finally {
      mediaQueryList.removeEventListener('change', listener);
    }
  });
}
