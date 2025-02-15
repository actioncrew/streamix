import { createEmission, createStream, Stream } from '../abstractions';

export function jsonp<T = any>(url: string, callbackName: string): Stream<T> {
  return createStream("jsonp", async function* () {
    return new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = `${url}?callback=${callbackName}`;

      // Create the callback function
      window[callbackName] = (data: T) => {
        resolve(createEmission({ value: data }));
        document.head.removeChild(script);
      };

      script.onerror = (error) => {
        reject(new Error(`JSONP request failed: ${error}`));
        document.head.removeChild(script);
      };

      document.head.appendChild(script);
    });
  });
}
