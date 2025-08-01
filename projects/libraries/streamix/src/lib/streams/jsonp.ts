import { createStream, Stream } from '../abstractions';

/**
 * Creates a stream that performs a JSONP request and emits the resulting data once.
 *
 * This function provides a reactive way to handle JSONP requests, which are
 * often used to bypass the same-origin policy for loading data from a different
 * domain. It dynamically creates a `<script>` tag, handles the response via a
 * global callback, and then cleans up after itself.
 */
export function jsonp<T = any>(url: string, callbackParam = 'callback'): Stream<T> {
  return createStream<T>('jsonp', async function* () {
    const uniqueCallbackName = `${callbackParam}_${Math.random().toString(36).slice(2)}`;
    const script = document.createElement('script');

    const fullUrl = `${url}${url.includes('?') ? '&' : '?'}${callbackParam}=${encodeURIComponent(uniqueCallbackName)}`;

    // Promise that resolves when JSONP callback fires or rejects on error
    const dataPromise = new Promise<T>((resolve, reject) => {
      (window as any)[uniqueCallbackName] = (data: T) => resolve(data);

      script.onerror = () => reject(new Error(`JSONP request failed: ${fullUrl}`));
    });

    script.src = fullUrl;
    document.head.appendChild(script);

    // Helper to cleanup
    const cleanup = () => {
      delete (window as any)[uniqueCallbackName];
      if (script.parentNode) {
        script.parentNode.removeChild(script);
      }
    };

    try {
      // Race the dataPromise against abort signal
      yield await dataPromise;
    } finally {
      cleanup();
    }
  });
}
