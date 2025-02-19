import { createEmission, createStream, Stream } from "../abstractions";

// Type for interceptors
export type RequestInterceptor = (request: Request) => Request | Promise<Request>;
export type ResponseInterceptor = (response: Response) => Response | Promise<Response>;

export type HttpStream<T = any> = Stream<T> & { abort: () => void };

export type HttpConfig = {
  fetchFn?: typeof fetch;
  interceptors?: {
    request?: RequestInterceptor[];
    response?: ResponseInterceptor[];
  }
  withXsrfProtection?: boolean;
  xsrfTokenHeader?: string;
};

export type HttpFetch = (
  url: string,
  options?: RequestInit,
  onProgress?: (progress: number) => void
) => HttpStream;

export const httpInit = (config: HttpConfig = {}): HttpFetch => {
  const { fetchFn = fetch, interceptors } = config;

  return (url: string, options?: RequestInit, onProgress?: (progress: number) => void): HttpStream => {
    const abortController = new AbortController();

    // Apply request interceptors
    const applyRequestInterceptors = async (request: Request): Promise<Request> => {
      if (interceptors?.request) {
        for (const interceptor of interceptors.request) {
          request = await interceptor(request);
        }
      }
      return request;
    };

    // Apply response interceptors
    const applyResponseInterceptors = async (response: Response): Promise<Response> => {
      if (interceptors?.response) {
          for (const interceptor of interceptors.response) {
          response = await interceptor(response);
        }
      }
      return response;
    };

    // Handle the body of the request depending on its type
    let body: any;
    const headers = new Headers(options?.headers || {});

    if (options?.body instanceof FormData) {
      // No need to set Content-Type for FormData, the browser will do it
      body = options.body;
    } else if (options?.body && options.body instanceof URLSearchParams) {
      // For x-www-form-urlencoded, we use URLSearchParams to encode the body
      if (!headers.has("Content-Type")) {
        headers.set("Content-Type", "application/x-www-form-urlencoded");
      }
      body = options.body.toString();
    } else if (options?.body) {
      // For JSON body, set Content-Type to application/json if not set
      if (!headers.has("Content-Type")) {
        headers.set("Content-Type", "application/json");
      }
      body = JSON.stringify(options.body);
    }

    // Fetch with interceptors
    const fetchWithInterceptors = async () => {
      if (abortController.signal.aborted) {
        return new Response(JSON.stringify({ error: "Request aborted" }), { status: 408 });
      }

      let request = new Request(url, {
        ...options,
        body,
        signal: abortController.signal,
      });

      request = await applyRequestInterceptors(request);
      const finalRequest = new Request(request, { signal: abortController.signal });

      try {
        const response = await fetchFn(finalRequest);
        return applyResponseInterceptors(response);
      } catch (error: any) {
        if (error.name === "AbortError") {
          return new Response(JSON.stringify({ error: "Request aborted" }), { status: 408 });
        }
        return new Response(JSON.stringify({ error: `Request failed: ${error.message}` }), { status: 500 });
      }
    };

    // Stream generator
    async function* streamGenerator() {
      const response = await fetchWithInterceptors();
      if (!response.ok) throw new Error(`Request failed with status ${response.status}`);

      const contentType = response.headers.get("Content-Type") || "";
      const isText = contentType.includes("text") || contentType.includes("json");

      let encoding = "utf-8";
      const match = contentType.match(/charset=([^;]+)/);
      if (match) encoding = match[1].trim().toLowerCase();

      const contentLength = response.headers.get("Content-Length");
      const totalSize = contentLength ? parseInt(contentLength, 10) : null;
      let loaded = 0;

      onProgress?.(0);

      if (!response.body) {
        // Determine the content type of the response
        let value: any = undefined;

        if (contentType.includes("application/json")) {
          // Parse the response as JSON if the content type is JSON
          value = await response.json();
        } else if (contentType.includes("text") || contentType.includes("html")) {
          // Parse the response as text if it's a textual content type
          value = await response.text();
        } else if (contentType.includes("application/x-www-form-urlencoded")) {
          // If it's URL-encoded, decode the text content
          value = decodeURIComponent(await response.text());
        } else if (contentType.includes("multipart/form-data")) {
          // If it's a multipart/form-data, convert it to FormData
          value = await response.formData();
        } else {
          // Default case for binary data (e.g., images, PDFs)
          value = new Uint8Array(await response.arrayBuffer());
        }

        onProgress?.(1);
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

          loaded += value.length;
          onProgress?.(totalSize ? loaded / totalSize : 0.5);
        }

        onProgress?.(1);
        const isJson = contentType.includes("json");
        yield createEmission({ value: isJson ? JSON.parse(fullText) : fullText });
      } else {
        let allChunks: Uint8Array[] = [];
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          allChunks.push(value);

          loaded += value.length;
          onProgress?.(totalSize ? loaded / totalSize : 0.5);
        }

        onProgress?.(1);
        const fullBinary = new Uint8Array(allChunks.reduce<number[]>((acc, val) => acc.concat([...val]), []));
        yield createEmission({ value: fullBinary });
      }
    }

    const stream = createStream("fetch", streamGenerator) as HttpStream;
    stream.abort = () => {
      abortController.abort();
    };

    return stream;
  };
};
