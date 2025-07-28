import { createStream, Stream } from '../abstractions';

/**
 * Creates a stream from `window.matchMedia` that emits whenever the media query matches or not.
 */
export function onMediaQuery(mediaQueryString: string): Stream<boolean> {
  const controller = new AbortController();
  const signal = controller.signal;

  return createStream<boolean>('onMediaQuery', async function* () {
    if (typeof window === 'undefined' || !window.matchMedia) {
      console.warn('matchMedia is not supported in this environment');
      return;
    }

    const mediaQueryList = window.matchMedia(mediaQueryString);
    let resolveNext: ((value: boolean) => void) | null = null;

    const listener = (event: MediaQueryListEvent) => {
      if (signal.aborted) return;
      resolveNext?.(event.matches);
      resolveNext = null;
    };

    mediaQueryList.addEventListener('change', listener);

    try {
      // Emit initial match result immediately
      yield mediaQueryList.matches;

      while (!signal.aborted) {
        const next = await new Promise<boolean>((resolve) => {
          resolveNext = resolve;
        });
        yield next;
      }
    } finally {
      mediaQueryList.removeEventListener('change', listener);
    }
  });
}
