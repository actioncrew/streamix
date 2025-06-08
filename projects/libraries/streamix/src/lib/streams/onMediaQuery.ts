import { createSubscription, Receiver } from '../abstractions';
import { createSubject } from '../streams';

/**
 * Creates a subscription from `window.matchMedia` for reactive media query handling.
 *
 * @param mediaQueryString - The media query string to observe.
 * @returns A Subscription function that returns the latest media query state.
 */
export function onMediaQuery(mediaQueryString: string) {
  if (!window.matchMedia) {
    console.warn("matchMedia is not supported in this environment");
    return createSubscription(() => false); // Return a dummy subscription
  }

  const subject = createSubject<boolean>();

  const mediaQueryList = window.matchMedia(mediaQueryString);
  let latestValue = mediaQueryList.matches; // Initial state

  const listener = (event: MediaQueryListEvent) => {
    latestValue = event.matches;
    subject.next(latestValue);
  };

  mediaQueryList.addEventListener("change", listener);

  const originalSubscribe = subject.subscribe;
  subject.subscribe = (callback?: ((value: boolean) => void) | Receiver<boolean>) => {
    const subscription = originalSubscribe.call(subject, callback);

    return createSubscription(() => {
      if (subject.completed()) {
        mediaQueryList.removeEventListener("change", listener);
      }
      subscription.unsubscribe();
    });
  }

  subject.name = 'onMediaQuery';
  return subject;
}
