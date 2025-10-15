import { Receiver, Stream } from '../abstractions';
import { createBehaviorSubject } from '../streams';

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
    return createBehaviorSubject<boolean>(false);
  }

  const mql = window.matchMedia(mediaQueryString);
  const subject = createBehaviorSubject<boolean>(mql.matches);
  subject.name = 'onMediaQuery';

  let listenerCount = 0;
  let listener: ((event: MediaQueryListEvent) => void) | null = null;

  const originalSubscribe = subject.subscribe;
  subject.subscribe = (callback?: ((value: boolean) => void) | Receiver<boolean>) => {
    // Set up listener on first subscription
    if (listenerCount === 0) {
      listener = (event: MediaQueryListEvent) => {
        subject.next(event.matches);
      };
      
      if (typeof mql.addEventListener === 'function') {
        mql.addEventListener('change', listener);
      } else if (typeof (mql as any).addListener === 'function') {
        (mql as any).addListener(listener);
      }
    }
    
    listenerCount++;
    const subscription = originalSubscribe.call(subject, callback);

    const cleanup = () => {
      listenerCount--;
      subscription.unsubscribe();
      
      // Remove listener when last subscriber unsubscribes
      if (listenerCount === 0 && listener) {
        if (typeof mql.removeEventListener === 'function') {
          mql.removeEventListener('change', listener);
        } else if (typeof (mql as any).removeListener === 'function') {
          (mql as any).removeListener(listener);
        }
        listener = null;
      }
    };

    const originalOnUnsubscribe = subscription.onUnsubscribe;
    subscription.onUnsubscribe = () => {
      originalOnUnsubscribe?.call(subscription);
      cleanup();
    };
    return subscription;
  };

  return subject;
}