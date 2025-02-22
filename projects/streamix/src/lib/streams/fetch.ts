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

export const initHttp = (config: HttpConfig = {}): HttpFetch => {
  const { fetchFn = fetch, interceptors, withXsrfProtection, xsrfTokenHeader } = config;

  return (url: string, options?: RequestInit, onProgress?: (progress: number) => void): HttpStream => {
    const abortController = new AbortController();

    // Extract XSRF token
    const getXsrfToken = (): string | null => {
      if (!withXsrfProtection) return null;
      return document.cookie
        .split("; ")
        .find((row) => row.startsWith("XSRF-TOKEN="))
        ?.split("=")[1] || localStorage.getItem("XSRF-TOKEN");
    };

    const encodeUrlEncoded = (params: Record<string, any>): string => {
      const urlSearchParams = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        urlSearchParams.append(key, String(value));
      });
      return urlSearchParams.toString();
    };

    // Apply request interceptors
    const applyRequestInterceptors = async (request: Request): Promise<Request> => {
      if (withXsrfProtection && xsrfTokenHeader && !request.headers.has(xsrfTokenHeader)) {
        const xsrfToken = getXsrfToken();
        if (xsrfToken && !["GET", "HEAD", "OPTIONS"].includes(request.method)) {
          request.headers.set(xsrfTokenHeader, xsrfToken);
        }
      }

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

    // Fetch with interceptors
    const fetchWithInterceptors = async () => {
      if (abortController.signal.aborted) {
        return new Response(JSON.stringify({ error: "Request aborted" }), { status: 408 });
      }

      let request = new Request(url, {
        ...options,
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
      if(options) {
        let body: any = undefined;
        if (options.body instanceof FormData) {
          // For FormData, no need to set Content-Type, browser will do it
          body = options.body;
        } else if (options.body instanceof URLSearchParams) {
          // For x-www-form-urlencoded, we use URLSearchParams to encode the body
          if (options.headers instanceof Headers && !options.headers.has("Content-Type")) {
            options.headers.set("Content-Type", "application/x-www-form-urlencoded");
          }
          body = encodeUrlEncoded(options.body as Record<string, any>); // Convert URLSearchParams to string
        } else if (options.body) {
          // For JSON body, set Content-Type to application/json if not set
          if (options.headers instanceof Headers && !options.headers.has("Content-Type")) {
            options.headers.set("Content-Type", "application/json");
          }

          body = JSON.stringify(options.body); // Stringify the JSON body

          if (options.headers instanceof Headers) {
            options.headers.set("Content-Length", body?.length || 0);
          }
        }

        options.body = body;
      }

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
        if (contentType.includes("x-ndjson")) {
          // Parse all NDJSON lines and return as an array
          const lines = fullText.trim().split("\n").filter(line => line.trim());
          const parsedJson = lines.map(line => JSON.parse(line));
          yield createEmission({ value: parsedJson }); // Yield the full array at once
        } else {
          // Regular JSON or plain text
          yield createEmission({ value: isJson ? JSON.parse(fullText) : fullText });
        }
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
