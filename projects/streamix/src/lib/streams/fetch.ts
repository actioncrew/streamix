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
  xsrfToken?: string;
  readInChunks?: boolean;
  useWebWorker?: boolean;
};

export type HttpFetch = (
  url: string,
  options?: RequestInit
) => HttpStream;

export const initHttp = (config: HttpConfig = {}): HttpFetch => {
  let {
    fetchFn = fetch,
    interceptors = { request: [], response: [] },
    withXsrfProtection = false,
    xsrfTokenHeader = 'X-XSRF-TOKEN',
    xsrfToken = null,
    readInChunks = false
  } = config;

  // Extract XSRF token
  const getXsrfToken = (): string | null => {
    if (!withXsrfProtection) return null;
    return document.cookie
      .split("; ")
      .find((row) => row.startsWith("XSRF-TOKEN="))
      ?.split("=")[1] || localStorage.getItem("XSRF-TOKEN");
  };

  if (xsrfToken) {
    xsrfToken = getXsrfToken();
  }

  return (url: string, options?: RequestInit): HttpStream => {
    const abortController = new AbortController();



    const encodeUrlEncoded = (params: Record<string, any>): string => {
      const urlSearchParams = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        urlSearchParams.append(key, String(value));
      });
      return urlSearchParams.toString();
    };

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

    // Fetch with interceptors
    const fetchWithInterceptors = async (request: Request) => {
      if (abortController.signal.aborted) {
        return new Response(JSON.stringify({ error: "Request aborted" }), { status: 408 });
      }

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
      let body: any = null;
      if(options) {
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
      }

      let request = new Request(url, {
        ...options,
        body,
        signal: abortController.signal,
      });

      if (withXsrfProtection && xsrfToken && xsrfTokenHeader && !request.headers.has(xsrfTokenHeader)) {
        if (!["GET", "HEAD", "OPTIONS"].includes(request.method)) {
          request.headers.set(xsrfTokenHeader, xsrfToken);
        }
      }

      const response = await fetchWithInterceptors(request);
      if (!response.ok) throw new Error(`Request failed with status ${response.status}`);

      const contentType = response.headers.get("Content-Type") || "";
      const isText = contentType.includes("text") || contentType.includes("json");
      const isNdjson = contentType.includes("x-ndjson");

      let encoding = "utf-8";
      const match = contentType.match(/charset=([^;]+)/);
      if (match) encoding = match[1].trim().toLowerCase();

      const contentLength = response.headers.get("Content-Length");
      const totalSize = contentLength ? parseInt(contentLength, 10) : null;
      let loaded = 0;

      if (!response.body) {
        let value: any;
        if (contentType.includes("application/json")) {
          value = await response.json();
        } else if (isText) {
          value = await response.text();
        } else if (contentType.includes("application/x-www-form-urlencoded")) {
          value = decodeURIComponent(await response.text());
        } else if (contentType.includes("multipart/form-data")) {
          value = await response.formData();
        } else {
          value = new Uint8Array(await response.arrayBuffer());
        }

        yield createEmission({ value });
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder(encoding);
      let ndjsonBuffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        loaded += value.length;
        const progress = totalSize ? loaded / totalSize : 0.5;

        if (readInChunks) {
          if (isNdjson) {
            ndjsonBuffer += decoder.decode(value, { stream: true });
            const lines = ndjsonBuffer.split("\n");
            ndjsonBuffer = lines.pop() || "";
            for (const line of lines) {
              if (line.trim()) {
                yield createEmission({ value: { chunk: JSON.parse(line), progress, done: false } });
              }
            }
          } else {
            const chunk = isText ? decoder.decode(value, { stream: true }) : value;
            yield createEmission({ value: { chunk, progress, done: false } });
          }
        } else {
          const chunk = isText ? decoder.decode(value, { stream: true }) : value;
          yield createEmission({ value: chunk });
        }
      }

      if (isNdjson && ndjsonBuffer.trim()) {
        yield createEmission({ value: { chunk: JSON.parse(ndjsonBuffer), progress: 1, done: false } });
      }

      if (readInChunks) {
        yield createEmission({ value: { chunk: null, progress: 1, done: true } });
      }
    }

    const stream = createStream("fetch", streamGenerator) as HttpStream;
    stream.abort = () => {
      abortController.abort();
    };

    return stream;
  };
};
