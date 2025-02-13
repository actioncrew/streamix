import { createEmission, createStream, Receiver, Stream } from "../abstractions";

// Type for interceptors
export type RequestInterceptor = (request: Request) => Request | Promise<Request>;
export type ResponseInterceptor = (response: Response) => Response | Promise<Response>;

export type FetchStream = {
  (url: string, options?: RequestInit | undefined): Stream<any>;
  // Add a request interceptor
  addRequestInterceptor: (interceptor: RequestInterceptor) => void;
  // Remove a request interceptor
  removeRequestInterceptor: (interceptor: RequestInterceptor) => void;
  // Add a response interceptor
  addResponseInterceptor: (interceptor: ResponseInterceptor) => void;
  // Remove a response interceptor
  removeResponseInterceptor: (interceptor: ResponseInterceptor) => void;
  // Abort the ongoing fetch request
  abort: () => void;
};

// Main `fetchStream` function
export function httpFetch(url: string, options?: RequestInit) {
  let requestInterceptors: RequestInterceptor[] = [];
  let responseInterceptors: ResponseInterceptor[] = [];
  let abortController: AbortController | undefined;

  // Apply request interceptors before making the fetch request
  const applyRequestInterceptors = async (request: Request): Promise<Request> => {
    let updatedRequest = request;
    for (let interceptor of requestInterceptors) {
      updatedRequest = await interceptor(updatedRequest);
    }
    return updatedRequest;
  };

  // Apply response interceptors after receiving the response
  const applyResponseInterceptors = async (response: Response): Promise<Response> => {
    let updatedResponse = response;
    for (let interceptor of responseInterceptors) {
      updatedResponse = await interceptor(updatedResponse);
    }
    return updatedResponse;
  };

  // Perform the fetch with interceptors
  const fetchWithInterceptors = async () => {

    if (abortController?.signal.aborted) {
      return new Response(
        JSON.stringify({ error: "Request aborted" }), // Custom error message
        { status: 408, statusText: "Request Aborted" }
      );
    }

    const request = new Request(url, options);
    const updatedRequest = await applyRequestInterceptors(request);

    // If there's an abortController, we need to create a new Request with the signal
    const finalRequest = abortController
      ? new Request(url, { ...options, signal: abortController.signal })
      : updatedRequest;

      try {
        const response = await fetch(finalRequest);
        return applyResponseInterceptors(response);
      } catch (error: any) {
        if (error.name === "AbortError") {
          return new Response(
            JSON.stringify({ error: "Request aborted" }), // Custom error message
            { status: 408, statusText: "Request Aborted" }
          );
        }

        return new Response(
          JSON.stringify({ error: `Request failed with error: ${error.message}` }),
          { status: 500, statusText: "Internal Server Error" }
        );
      }
  };

  // Stream generator to handle small and large files
  async function* streamGenerator() {
    const response = await fetchWithInterceptors();

    // Handle non-OK responses
    if (!response.ok) {
      throw new Error(`Request failed with status ${response.status}`);
    }

    const reader = response.body?.getReader();
    if (reader) {
      // Handle non-trivial stream chunks (large file handling)
      let done = false;
      while (!done) {
        const { value, done: readerDone } = await reader.read();
        done = readerDone;

        if (abortController?.signal.aborted) {
          console.warn("Request was aborted");
          return;
        }

        if (value) {
          yield createEmission({ value });
        }
      }
    } else {
      // If the response body is not a stream, return the entire content as a single chunk
      const text = await response.text();
      yield createEmission({ value: new TextEncoder().encode(text) });
    }
  }

  // The stream instance that will hold the subscriptions
  const stream = createStream("fetchStream", streamGenerator);

  // **Methods attached directly to `fetchStream` function**:
  const fetchInstance = httpFetch as FetchStream;

  // Add a request interceptor
  fetchInstance.addRequestInterceptor = (interceptor: RequestInterceptor) => {
    requestInterceptors.push(interceptor);
  };

  // Remove a request interceptor
  fetchInstance.removeRequestInterceptor = (interceptor: RequestInterceptor) => {
    requestInterceptors = requestInterceptors.filter((i) => i !== interceptor);
  };

  // Add a response interceptor
  fetchInstance.addResponseInterceptor = (interceptor: ResponseInterceptor) => {
    responseInterceptors.push(interceptor);
  };

  // Remove a response interceptor
  fetchInstance.removeResponseInterceptor = (interceptor: ResponseInterceptor) => {
    responseInterceptors = responseInterceptors.filter((i) => i !== interceptor);
  };

  // Abort method to cancel the ongoing request
  fetchInstance.abort = () => {
    if (!abortController) {
      abortController = new AbortController();
    } else {
      abortController.abort();
      abortController = new AbortController(); // Reset after abort
    }
  };

  // Override the `subscribe` method to handle aborting in `unsubscribe`
  const originalSubscribe = stream.subscribe;
  stream.subscribe = (callbackOrReceiver?: ((value: Uint8Array) => void) | Receiver<Uint8Array>) => {
    const subscription = originalSubscribe.call(stream, callbackOrReceiver);

    const unsubscribe = subscription.unsubscribe;
    subscription.unsubscribe = () => {
      // Trigger abort when unsubscribing
      fetchInstance.abort();
      unsubscribe();
    };

    return subscription;
  };

  return stream;
}
