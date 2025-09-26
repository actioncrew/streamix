import { createSubscription, Receiver, Stream } from '../abstractions';
import { createSubject } from '../streams';

/**
 * Creates a reactive stream that emits `true` or `false` whenever a CSS media query
 * matches or stops matching.
 *
 * This stream allows you to reactively track viewport changes, orientation, or
 * other media features in a consistent, subscription-based way.
 *
 * **Behavior:**
 * - The initial match status is emitted immediately upon subscription.
 * - Subsequent changes are emitted whenever the media query's match state changes.
 * - Each subscriber has its own listener, which is cleaned up when unsubscribing.
 *
 * @param mediaQueryString A valid CSS media query string (e.g., "(min-width: 600px)").
 * @returns {Stream<boolean>} A stream emitting `true` if the query matches, `false` otherwise.
 */
export function onMediaQuery(mediaQueryString: string): Stream<boolean> {
  if (typeof window === 'undefined' || !window.matchMedia) {
    console.warn('matchMedia is not supported in this environment');
    const subject = createSubject<boolean>();
    return subject;
  }

  const subject = createSubject<boolean>();
  subject.name = 'onMediaQuery';

  const originalSubscribe = subject.subscribe;
  subject.subscribe = (callback?: ((value: boolean) => void) | Receiver<boolean>) => {
    const subscription = originalSubscribe.call(subject, callback);

    const mediaQueryList = window.matchMedia(mediaQueryString);

    const listener = (event: MediaQueryListEvent) => {
      subject.next(event.matches);
    };

    mediaQueryList.addEventListener('change', listener);

    // Emit initial match status immediately
    subject.next(mediaQueryList.matches);

    return createSubscription(() => {
      mediaQueryList.removeEventListener('change', listener);
      subscription.unsubscribe();
    });
  };

  return subject;
}
