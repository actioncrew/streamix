import { createEmission, createStream, Stream } from "../abstractions";

export type HttpStream<T = any> = Stream<T> & { abort: () => void };
  
export type HttpOptions = {
  headers?: Record<string, string>;
  params?: Record<string, string>;
  withCredentials?: boolean;
  body?: any;
}

export type HttpClientConfig = {
  baseUrl?: string;
  defaultHeaders?: Record<string, string>;
};

export type ResponseParser = {
  arrayBuffer(): HttpStream<ArrayBuffer>;
  blob(): HttpStream<Blob>;
  json<T = any>(): HttpStream<T>;
  text(): HttpStream<string>;
  readChunks<T = any>(): HttpStream<T>;
  readFull<T = any>(): HttpStream<T>;
};

export type Middleware = (
  next: (request: Request) => Promise<Response>
) => (request: Request) => Promise<Response>;

export type HttpClient = {
  use(this: HttpClient, ...middlewares: Middleware[]): HttpClient;
  get(url: string, options?: HttpOptions): ResponseParser;
  post(url: string, options?: HttpOptions): ResponseParser;
  put(url: string, options?: HttpOptions): ResponseParser;
  patch(url: string, options?: HttpOptions): ResponseParser;
  delete(url: string, options?: HttpOptions): ResponseParser;
};

// --- Base Middleware ---
export const base = (baseUrl: string): Middleware => {
  return (next) => async (request: Request) => {
    const url = request.url.startsWith('http://') || request.url.startsWith('https://')
      ? request.url // If already absolute, use it directly
      : new URL(request.url, baseUrl).toString();

    const modifiedRequest = new Request(url, {
      ...request, // Clone request details
      headers: new Headers(request.headers),
    });

    return await next(modifiedRequest);
  };
};

// --- Accept Middleware ---
export const accept = (contentType: string): Middleware => {
  return (next) => async (request: Request) => {
    request.headers.set("Accept", contentType);
    return next(request);
  };
};

// --- Auth Middleware ---
export const oauthToken = (token: string): Middleware => {
  return (next) => async (request: Request) => {
    request.headers.set("Authorization", `Bearer ${token}`);
    return next(request);
  };
};

// --- Body Middleware ---
export const body = (content: any, contentType: string): Middleware => {
  return (next) => async (request: Request) => {
    const modifiedRequest = new Request(request.url, {
      ...request,
      body: content,
      headers: { ...request.headers, "Content-Type": contentType },
    });
    return next(modifiedRequest);
  };
};

// --- Redirect Middleware ---
export const redirect = (maxRedirects: number = 5): Middleware => {
  return (next) => async (request: Request) => {
    let redirectCount = 0;
    let currentRequest = request;

    while (redirectCount < maxRedirects) {
      const response = await next(currentRequest);

      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const location = response.headers.get("Location");

        if (!location) {
          throw new Error("Redirect response missing Location header");
        }

        let newMethod = currentRequest.method;
        let newBody = currentRequest.body;

        if (response.status === 303) {
          newMethod = "GET";
          newBody = null;
        }

        const newUrl = new URL(location, currentRequest.url).toString();
        currentRequest = new Request(newUrl, {
          method: newMethod,
          headers: currentRequest.headers,
          body: newBody,
          signal: currentRequest.signal,
        });

        redirectCount++;
      } else {
        return response;
      }
    }

    throw new Error("Too many redirects");
  };
};

// --- Header Middleware ---
export const header = (name: string, value: string): Middleware => {
  return (next) => async (request: Request) => {
    request.headers.set(name, value);
    return next(request);
  };
};

// --- JSON Middleware ---
export const json = (object: any): Middleware => {
  return body(JSON.stringify(object), "application/json");
};

// --- Params Middleware ---
export const params = (data: Record<string, any>): Middleware => {
  return (next) => async (request: Request) => {
    const url = new URL(request.url);
    const method = request.method.toUpperCase();

    if (["GET", "HEAD"].includes(method)) {
      Object.keys(data).forEach((key) => {
        url.searchParams.append(key, data[key]);
      });
      request = new Request(url.toString(), {
        method: request.method,
        headers: request.headers,
        body: request.body,
        signal: request.signal,
      });
    } else {
      const formData = new URLSearchParams();
      Object.keys(data).forEach((key) => {
        formData.append(key, data[key]);
      });
      request = new Request(request.url, {
        method: request.method,
        headers: request.headers,
        body: formData,
        signal: request.signal,
      });
    }

    return next(request);
  };
};

// --- Error Handling Middleware ---
export const errorHandler = (handler: (error: any, request: Request) => Response | Promise<Response>): Middleware => {
  return (next) => async (request: Request) => {
    try {
      return await next(request);
    } catch (error) {
      return handler(error, request);
    }
  };
};

// --- Logging Middleware ---
export const logging = (logger: (message: string) => void = console.log): Middleware => {
  return (next) => async (request: Request) => {
    logger(`Request: ${request.method} ${request.url}`);
    const response = await next(request);
    logger(`Response: ${response.status} ${request.url}`);
    return response;
  };
};

// --- Caching Middleware ---
const cache = new Map<string, Response>();
export const caching = (): Middleware => {
  return (next) => async (request: Request) => {
    const cacheKey = `${request.method}:${request.url}`;
    if (request.method === "GET" && cache.has(cacheKey)) {
      return cache.get(cacheKey)!.clone();
    }
    const response = await next(request);
    if (request.method === "GET" && response.ok) {
      cache.set(cacheKey, response.clone());
    }
    return response;
  };
};

// --- Timeout Middleware ---
export const timeout = (ms: number): Middleware => {
  return (next) => async (request: Request) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), ms);

    // Combine existing signal with timeout signal
    const combinedSignal = request.signal
      ? AbortSignal.any([request.signal, controller.signal])
      : controller.signal;

    const modifiedRequest = new Request(request.url, {
      ...request,
      signal: combinedSignal, // Use the combined signal
    });

    try {
      const response = await next(modifiedRequest);
      clearTimeout(timeoutId);
      return response;
    } catch (error: any) {
      clearTimeout(timeoutId);
      if (error.name === "AbortError") {
        throw new Error("Request timed out");
      }
      throw error;
    }
  };
};

// --- XSRF/CSRF Protection Middleware ---
export const xsrfProtection = (tokenHeader: string, token: string): Middleware => {
  return (next) => async (request: Request) => {
    if (!["GET", "HEAD", "OPTIONS"].includes(request.method)) {
      request.headers.set(tokenHeader, token);
    }
    return next(request);
  };
};

// --- Retry Middleware ---
export const retry = (maxRetries: number = 3, retryDelay: number = 1000): Middleware => {
  return (next) => async (request: Request) => {
    let attempts = 0;
    while (attempts < maxRetries) {
      try {
        return await next(request);
      } catch (error) {
        attempts++;
        if (attempts >= maxRetries) {
          throw error;
        }
        await new Promise((resolve) => setTimeout(resolve, retryDelay));
      }
    }
    throw new Error("Max retries exceeded");
  };
};

export const createHttpClient = (
  config: HttpClientConfig = {
    defaultHeaders: { "Content-Type": "application/json" },
  }
): HttpClient => {
  const { baseUrl, defaultHeaders } = config;
  const middlewares: Middleware[] = [];

  const resolveUrl = (url: string, params?: Record<string, string>): string => {
    const fullUrl =
      url.startsWith("http://") || url.startsWith("https://")
        ? url
        : new URL(url, baseUrl || "").toString();

    if (params) {
      const urlObj = new URL(fullUrl);
      Object.entries(params).forEach(([key, value]) =>
        urlObj.searchParams.append(key, value)
      );
      return urlObj.toString();
    }

    return fullUrl;
  };

  const mergeHeaders = (defaultHeaders: Headers, customHeaders: Headers): Headers => {
    const mergedHeaders = new Headers(defaultHeaders);
    customHeaders.forEach((value, key) => {
      mergedHeaders.set(key, value);
    });
    return mergedHeaders;
  };

  const toHeaders = (headers: Record<string, string> | Headers): Headers => {
    return headers instanceof Headers ? headers : new Headers(headers);
  };

  const chainMiddleware = middlewares.reduceRight(
    (nextMiddleware, middleware) => middleware(nextMiddleware),
    async (request: Request): Promise<Response> => {
      return await fetch(request);
    }
  );

  const request = (method: string, url: string, options: HttpOptions = {}): ResponseParser => {
    const headers = mergeHeaders(toHeaders(defaultHeaders || {}), toHeaders(options.headers || {}));
    const abortController = new AbortController();

    const requestOptions: RequestInit = {
      method,
      headers,
      body: options.body,
      credentials: options.withCredentials ? "include" : "same-origin",
      signal: abortController.signal,
    };

    const finalUrl = resolveUrl(url, options.params);
    const request = new Request(finalUrl, requestOptions);
    const response = chainMiddleware(request);
    return createResponseParser(response);
  };

  return {
    use: function (this: HttpClient, ...newMiddlewares: Middleware[]) {
      middlewares.push(...newMiddlewares);
      return this;
    },
    get: (url: string, options?: HttpOptions): ResponseParser =>
      request("GET", url, options),
    post: (url: string, options?: HttpOptions): ResponseParser =>
      request("POST", url, options),
    put: (url: string, options?: HttpOptions): ResponseParser =>
      request("PUT", url, options),
    patch: (url: string, options?: HttpOptions): ResponseParser =>
      request("PATCH", url, options),
    delete: (url: string, options?: HttpOptions): ResponseParser =>
      request("DELETE", url, options)
  };
};

const createResponseParser = (responsePromise: Promise<Response>): ResponseParser => {
  const parseStream = (responsePromise: Promise<Response>, parseMethod: string): HttpStream => {
    async function* streamGenerator() {
      try {
        const response = await responsePromise;
        if (!response.ok) throw new Error(`Request failed with status ${response.status}`);

        const contentType = response.headers.get("Content-Type") || "";
        const isTextResponse = contentType.includes("text") || contentType.includes("json");
        const isNdjson = contentType.includes("x-ndjson");
        const isBinaryResponse = !isTextResponse && !isNdjson;

        let encoding = "utf-8";
        const match = contentType.match(/charset=([^;]+)/);
        if (match) encoding = match[1].trim().toLowerCase();

        const contentLength = response.headers.get("Content-Length");
        const totalSize = contentLength ? parseInt(contentLength, 10) : null;

        if (!response.body) {
          yield createEmission({ value: await handleRegularResponse(response, parseMethod) });
          return;
        }

        if (isBinaryResponse) {
          yield* handleBinaryResponse(response, parseMethod, totalSize);
        } else {
          yield* handleTextResponse(response, parseMethod, isNdjson, encoding, totalSize);
        }
      } catch (error: any) {
        yield createEmission({ error: error.message });
      }
    }

    return createStream("httpStream", streamGenerator) as HttpStream;
  };

  /** Handles non-stream (small) responses */
  async function handleRegularResponse(response: Response, parseMethod: string): Promise<any> {
    switch (parseMethod) {
      case "json":
        return await response.json();
      case "text":
        return await response.text();
      case "arrayBuffer":
      case "readFull":
        return new Uint8Array(await response.arrayBuffer());
      case "blob":
        return await response.blob();
      default:
        throw new Error(`Unsupported parse method: ${parseMethod}`);
    }
  }

  /** Handles binary stream responses */
  async function* handleBinaryResponse(response: Response, parseMethod: string, totalSize: number | null) {
    const reader = response.body!.getReader();
    let loaded = 0;
    let chunks: Uint8Array[] = [];

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      if (value) {
        loaded += value.length;
        const progress = totalSize ? loaded / totalSize : 0.5;

        if (parseMethod === "readChunks") {
          yield createEmission({ value: { chunk: value, progress, done: false } });
        } else {
          chunks.push(value);
        }
      }
    }

    if (parseMethod === "readChunks") {
      yield createEmission({ value: { chunk: null, progress: 1, done: true } });
    } else {
      // Combine all chunks into a single Uint8Array
      const fullResponse = chunks.length
        ? new Uint8Array(chunks.reduce((acc, chunk) => [...acc, ...chunk], [] as any[]))
        : new Uint8Array(0); // Handle empty response properly

      yield createEmission({ value: fullResponse });
    }
  }

  /** Handles text-based stream responses */
  async function* handleTextResponse(
    response: Response,
    parseMethod: string,
    isNdjson: boolean,
    encoding: string,
    totalSize: number | null
  ) {
    const reader = response.body!.getReader();
    const decoder = new TextDecoder(encoding);
    let loaded = 0;
    let ndjsonBuffer = "";
    let fullResponse: any = isNdjson ? [] : "";

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      if (value) {
        loaded += value.length;
        const progress = totalSize ? loaded / totalSize : 0.5;
        const chunk = decoder.decode(value, { stream: true });

        if (parseMethod === "readChunks") {
          if (isNdjson) {
            ndjsonBuffer += chunk;
            const lines = ndjsonBuffer.split("\n");
            ndjsonBuffer = lines.pop() || ""; // Keep the last unfinished line

            for (const line of lines) {
              if (line.trim()) {
                try {
                  yield createEmission({ value: { chunk: JSON.parse(line), progress, done: false } });
                } catch (error) {
                  console.warn("Invalid NDJSON line:", error);
                }
              }
            }
          } else {
            yield createEmission({ value: { chunk, progress, done: false } });
          }
        } else {
          if (isNdjson) {
            fullResponse.push(...chunk.split("\n").filter(line => line.trim())); // Collect NDJSON lines
          } else {
            fullResponse += chunk; // Collect plain text or JSON string
          }
        }
      }
    }

    // Handle the last NDJSON buffer if not fully processed
    if (isNdjson && ndjsonBuffer.trim()) {
      const lines = ndjsonBuffer.split("\n").filter(line => line.trim()); // Filter out empty lines

      for (const line of lines) {
        try {
          // Calculate progress for each line in the final buffer
          const progress = totalSize ? loaded / totalSize : 0.5; // Use the last calculated loaded value

          yield createEmission({ value: { chunk: JSON.parse(line), progress, done: false } });
        } catch (error: any) {
          console.warn("Invalid final NDJSON line:", error);
        }
      }
    }

    if (parseMethod === "readChunks") {
      yield createEmission({ value: { chunk: null, progress: 1, done: true } });
    } else {
      let finalValue = fullResponse as string;
      if (parseMethod === "json") {
        try {
          finalValue = JSON.parse(finalValue);
        } catch (error) {
          console.warn("Invalid JSON response:", error);
        }
      }
      yield createEmission({ value: finalValue });
    }
  }

  return {
    arrayBuffer: () => parseStream(responsePromise, "arrayBuffer"),
    blob: () => parseStream(responsePromise, "blob"),
    json: <T>() => parseStream(responsePromise, "json") as HttpStream<T>,
    text: () => parseStream(responsePromise, "text"),
    readChunks: <T>() => parseStream(responsePromise, "readChunks") as HttpStream<T>,
    readFull: <T>() => parseStream(responsePromise, "readFull") as HttpStream<T>,
  };
};

