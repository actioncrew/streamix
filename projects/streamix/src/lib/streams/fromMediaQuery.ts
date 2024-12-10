import { createStream, hooks, internals, Stream } from '../abstractions';
import { eventBus } from '../abstractions';

/**
 * Creates a Stream from `window.matchMedia` for reactive media query handling.
 * Uses eventBus for emissions.
 *
 * @param mediaQueryString - The media query string to observe.
 * @returns A reactive Stream that emits boolean values when media query matches change.
 *
 * @example
 * // Example usage:
 * import { fromMediaQuery } from './your-path';
 *
 * const mediaQueryStream = fromMediaQuery('(min-width: 768px)');
 *
 * const subscription = mediaQueryStream.subscribe({
 *   next: (matchStatus) => {
 *     console.log('Media Query Match:', matchStatus);
 *   },
 * });
 */
export function fromMediaQuery(mediaQueryString: string): Stream<boolean> {
  const stream = createStream<boolean>(async function (this: Stream<boolean>) {
    if (!window.matchMedia) {
      console.warn('matchMedia is not supported in this environment');
      return;
    }

    const mediaQueryList = window.matchMedia(mediaQueryString);

    // Emit the initial state
    eventBus.enqueue({
      target: this,
      payload: { value: mediaQueryList.matches },
      type: 'emission',
    });

    // Define the event listener to monitor changes
    const listener = (event: MediaQueryListEvent) => {
      eventBus.enqueue({
        target: this,
        payload: { value: event.matches },
        type: 'emission',
      });
    };

    mediaQueryList.addEventListener('change', listener);

    await this[internals].awaitCompletion();

    mediaQueryList.removeEventListener('change', listener);
  });

  stream.name = 'fromMediaQuery';
  return stream;
}