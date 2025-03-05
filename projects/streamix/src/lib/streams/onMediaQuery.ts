import { createSubject, createSubscription } from "../abstractions";

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

  return createSubscription(() => subject.value(), () => {
    mediaQueryList.removeEventListener("change", listener);
    subject.complete();
  });
}
