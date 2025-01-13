import { createEmission, createStream, internals, Stream } from '../abstractions';

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
 * const mediaQueryStream = onMediaQuery('(min-width: 768px)');
 *
 * const subscription = mediaQueryStream({
 *   next: (matchStatus) => {
 *     console.log('Media Query Match:', matchStatus);
 *   },
 * });
 */
export function onMediaQuery(mediaQueryString: string): Stream<boolean> {
  const stream = createStream<boolean>('fromMediaQuery', async function (this: Stream<boolean>) {
    if (!window.matchMedia) {
      console.warn('matchMedia is not supported in this environment');
      return;
    }

    const mediaQueryList = window.matchMedia(mediaQueryString);

    // Emit the initial state
    this.next(createEmission({ value: mediaQueryList.matches }));

    // Define the event listener to monitor changes
    const listener = (event: MediaQueryListEvent) => {
      this.next(createEmission({ value: event.matches }));
    };

    mediaQueryList.addEventListener('change', listener);

    await this[internals].awaitCompletion();

    mediaQueryList.removeEventListener('change', listener);
  });

  return stream;
}
