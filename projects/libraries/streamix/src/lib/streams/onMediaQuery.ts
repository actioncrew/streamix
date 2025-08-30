import { createStream, PipelineContext, Stream } from '../abstractions';

/**
 * Creates a stream that emits `true` or `false` when a CSS media query's
 * status changes.
 *
 * This is a reactive wrapper around the `window.matchMedia` API,
 * allowing you to easily react to changes in screen size, orientation,
 * or other media features. The stream emits the initial match status upon
 * subscription and then emits a new value for every subsequent change.
 *
 * @param {string} mediaQueryString The CSS media query string to match (e.g., "(min-width: 600px)").
 * @returns {Stream<boolean>} A stream that emits `true` if the media query matches, and `false` otherwise.
 */
export function onMediaQuery(mediaQueryString: string, context?: PipelineContext): Stream<boolean> {
  return createStream<boolean>('onMediaQuery', async function* () {
    if (typeof window === 'undefined' || !window.matchMedia) {
      console.warn('matchMedia is not supported in this environment');
      return;
    }

    const mediaQueryList = window.matchMedia(mediaQueryString);
    let resolveNext: ((value: boolean) => void) | null = null;

    const listener = (event: MediaQueryListEvent) => {
      resolveNext?.(event.matches);
      resolveNext = null;
    };

    mediaQueryList.addEventListener('change', listener);

    try {
      // Emit initial match result immediately
      yield mediaQueryList.matches;

      while (true) {
        const next = await new Promise<boolean>((resolve) => {
          resolveNext = resolve;
        });
        yield next;
      }
    } finally {
      mediaQueryList.removeEventListener('change', listener);
    }
  }, context);
}
