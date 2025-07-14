import { createStream, Stream } from '../abstractions';

/**
 * Creates a stream from `window.matchMedia` that emits whenever the media query matches or not.
 */
export function onMediaQuery(mediaQueryString: string): Stream<boolean> {
  return createStream<boolean>('onMediaQuery', async function* () {
    if (typeof window === 'undefined' || !window.matchMedia) {
      console.warn('matchMedia is not supported in this environment');
      return;
    }

    const mediaQueryList = window.matchMedia(mediaQueryString);
    let resolveNext: ((value: boolean) => void) | null = null;
    let isActive = true;

    const listener = (event: MediaQueryListEvent) => {
      if (isActive && resolveNext) {
        resolveNext(event.matches);
        resolveNext = null;
      }
    };

    mediaQueryList.addEventListener('change', listener);

    try {
      // Emit initial value immediately
      yield mediaQueryList.matches;

      while (isActive) {
        const next = await new Promise<boolean>((resolve) => {
          resolveNext = resolve;
        });
        yield next;
      }
    } finally {
      isActive = false;
      mediaQueryList.removeEventListener('change', listener);
    }
  });
}
