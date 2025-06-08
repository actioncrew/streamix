import { createSubscription, Receiver } from "../abstractions";
import { createSubject, Subject } from "../streams";

export function jsonp<T = any>(url: string, callbackName: string): Subject<T> {
  const subject = createSubject<T>();

  const originalSubscribe = subject.subscribe;
  subject.subscribe = (callback?: ((value: T) => void) | Receiver<T>) => {
    const subscription = originalSubscribe.call(subject, callback);

    const uniqueCallbackName = `${callbackName}_${Math.random().toString(36).substring(2)}`;
    const script = document.createElement("script");

    // Create the callback function
    (window as any)[uniqueCallbackName] = (data: T) => {
      subject.next(data); // Emit the data once the script loads
      subject.complete(); // Complete the subject
    };

    // Handle script errors
    script.onerror = (error) => {
      subject.error(new Error(`JSONP request failed: ${error}`)); // Emit error if JSONP request fails
      document.head.removeChild(script); // Clean up the script element
    };

    // Append the script element to the document head
    script.src = `${url}${url.includes('?') ? '&' : '?'}callback=${encodeURIComponent(uniqueCallbackName)}`;
    document.head.appendChild(script);

    return createSubscription(() => {
      document.head.removeChild(script); // Clean up the script element
      delete (window as any)[uniqueCallbackName]; // Clean up the callback function
      subscription.unsubscribe();
    });
  };

  subject.name = 'jsonp';
  return subject;
}
