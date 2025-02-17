import { createEmission, createStream, Stream } from '../abstractions';

export function jsonp<T = any>(url: string, callbackName: string): Stream<T> {
  return createStream("jsonp", async function* () {
    let data = await new Promise<T>((resolve, reject) => {
      const script = document.createElement("script");
      callbackName = `${callbackName}_${Math.random().toString(36).substring(2)}`;

      script.src = url.endsWith("?")  
        ? url + encodeURIComponent(callbackName)  
        : url + (url.includes("?") ? "&" : "?") + `callback=${encodeURIComponent(callbackName)}`;

      // Create the callback function
      (window as any)[callbackName] = (data: T) => {
        resolve(data);
        document.head.removeChild(script);
      };

      script.onerror = (error) => {
        reject(new Error(`JSONP request failed: ${error}`));
        document.head.removeChild(script);
      };

      document.head.appendChild(script);
    });

    yield createEmission({ value: data });
  });
}
