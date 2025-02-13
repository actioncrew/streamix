import { createEmission, createStream, Stream } from "../abstractions";

// Type for interceptors
export type RequestInterceptor = (request: Request) => Request | Promise<Request>;
export type ResponseInterceptor = (response: Response) => Response | Promise<Response>;

export type HttpStream = Stream & { abort: () => void };

export type HttpFetch = {
  (url: string, options?: RequestInit | undefined): HttpStream;
  // Add a request interceptor
  addRequestInterceptor: (interceptor: RequestInterceptor) => void;
  // Remove a request interceptor
  removeRequestInterceptor: (interceptor: RequestInterceptor) => void;
  // Add a response interceptor
  addResponseInterceptor: (interceptor: ResponseInterceptor) => void;
  // Remove a response interceptor
  removeResponseInterceptor: (interceptor: ResponseInterceptor) => void;
};

let requestInterceptors: RequestInterceptor[] = [];
let responseInterceptors: ResponseInterceptor[] = [];

// Main `fetchStream` function
export const httpFetch: HttpFetch = function(url: string, options?: RequestInit): HttpStream {
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

    // Extract content type and encoding from headers
    const contentType = response.headers.get("Content-Type") || "";
    const isText = contentType.includes("text") || contentType.includes("json");

    // Default to UTF-8 but check for encoding in Content-Type
    let encoding = "utf-8";
    const match = contentType.match(/charset=([^;]+)/);
    if (match) {
      encoding = match[1].trim().toLowerCase();
    }

    // If there's no body, read response as text or binary
    if (!response.body) {
      const value = isText ? await response.text() : new Uint8Array(await response.arrayBuffer());
      yield createEmission({ value });
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder(encoding);

    if (isText) {
      let fullText = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        fullText += decoder.decode(value, { stream: true });
      }
      yield createEmission({ value: fullText });
    } else {
      let allChunks: Uint8Array[] = [];
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        allChunks.push(value);
      }
      const fullBinary = new Uint8Array(allChunks.reduce<number[]>((acc, val) => acc.concat(Array.from(val)), []));
      yield createEmission({ value: fullBinary });
    }
  }

  // The stream instance that will hold the subscriptions
  const stream = createStream("fetchStream", streamGenerator) as HttpStream;

  // Abort method to cancel the ongoing request
  stream.abort = () => {
    if (!abortController) {
      abortController = new AbortController();
    } else {
      abortController.abort();
      abortController = new AbortController(); // Reset after abort
    }
  };

  return stream;
} as HttpFetch;

// Add a request interceptor
httpFetch.addRequestInterceptor = (interceptor: RequestInterceptor) => {
  requestInterceptors.push(interceptor);
};

// Remove a request interceptor
httpFetch.removeRequestInterceptor = (interceptor: RequestInterceptor) => {
  requestInterceptors = requestInterceptors.filter((i) => i !== interceptor);
};

// Add a response interceptor
httpFetch.addResponseInterceptor = (interceptor: ResponseInterceptor) => {
  responseInterceptors.push(interceptor);
};

// Remove a response interceptor
httpFetch.removeResponseInterceptor = (interceptor: ResponseInterceptor) => {
  responseInterceptors = responseInterceptors.filter((i) => i !== interceptor);
};
