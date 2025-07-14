import { Stream, createStream } from '../abstractions';

export function jsonp<T = any>(url: string, callbackParam = 'callback'): Stream<T> {
  return createStream('jsonp', async function* () {
    const uniqueCallbackName = `${callbackParam}_${Math.random().toString(36).slice(2)}`;
    const script = document.createElement('script');

    const fullUrl = `${url}${url.includes('?') ? '&' : '?'}${callbackParam}=${encodeURIComponent(uniqueCallbackName)}`;

    // This will be called by the JSONP response
    const dataPromise = new Promise<T>((resolve, reject) => {
      (window as any)[uniqueCallbackName] = (data: T) => resolve(data);

      script.onerror = () => reject(new Error(`JSONP request failed: ${fullUrl}`));
    });

    script.src = fullUrl;
    document.head.appendChild(script);

    try {
      const data = await dataPromise;
      yield data;
    } finally {
      delete (window as any)[uniqueCallbackName];
      document.head.removeChild(script);
    }
  });
}
