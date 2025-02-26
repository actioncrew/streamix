import { createEmission, createStream, Stream } from "../abstractions";

export type HttpStream<T = any> = Stream<T> & { abort: () => void };

export type HttpOptions = {
  headers?: Record<string, string>;
  params?: Record<string, string>;
  withCredentials?: boolean;
  body?: any;
};

export type ResponseParser = {
  arrayBuffer(): HttpStream<ArrayBuffer>;
  blob(): HttpStream<Blob>;
  json<T = any>(): HttpStream<T>;
  text(): HttpStream<string>;
  readChunks<T = any>(): HttpStream<T>;
  readFull<T = any>(): HttpStream<T>;
};

export type Context = {
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: any;
  params?: Record<string, string>;
  response?: Response;
  request?: Request;
  promise?: Promise<any>;
  [key: string]: any;
};

export type Middleware = (
  next: (context: Context) => Context
) => (context: Context) => Context;

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
  return (next) => (context: Context) => {
    const url = context.url.startsWith('http://') || context.url.startsWith('https://')
      ? context.url // If already absolute, use it directly
      : new URL(context.url, baseUrl).toString();

    context.url = url;
    return next(context);
  };
};

// --- Accept Middleware ---
export const accept = (contentType: string): Middleware => {
  return (next) => (context) => {
    context.headers["Accept"] = contentType;
    return next(context);
  };
};

// --- Auth Middleware ---
export const oauthToken = (token: string): Middleware => {
  return (next) => (context) => {
    context.headers["Authorization"] = `Bearer ${token}`;
    return next(context);
  };
};

// --- Body Middleware ---
export const body = (content: any, contentType: string): Middleware => {
  return (next) => (context) => {
    context.body = content;
    context.headers["Content-Type"] = contentType;
    return next(context);
  };
};

// --- Redirect Middleware ---
export const redirect = (maxRedirects: number = 5): Middleware => {
  return (next) => (context) => {
    let redirectCount = 0;

    // Helper function to handle the redirect logic
    const handleRedirect = (context: Context): Context => {
      if (redirectCount >= maxRedirects) {
        throw new Error("Too many redirects");
      }

      // Pass the context to the next middleware
      const newContext = next(context);

      // Ensure the promise is available in the context
      if (!newContext['promise']) {
        throw new Error("No response promise returned from middleware");
      }

      // Chain the promise to handle the response
      newContext['promise'] = newContext['promise'].then((response: Response) => {
        // Attach the resolved response to the context
        newContext.response = response;

        // Check if the response is a redirect
        if ([301, 302, 303, 307, 308].includes(response.status)) {
          const location = response.headers.get("Location");
          if (!location) {
            throw new Error("Redirect response missing Location header");
          }

          // Update the URL for the next request
          newContext.url = new URL(location, newContext.url).toString();

          // For 303, change the method to GET and remove the body
          if (response.status === 303) {
            newContext.method = "GET";
            newContext.body = undefined;
          }

          redirectCount++;

          // Recursively handle the next redirect
          return handleRedirect(newContext)['promise'];
        } else {
          // If not a redirect, return the response
          return response;
        }
      }).catch((error: any) => {
        // Propagate errors to the caller
        throw error;
      });

      // Return the context synchronously
      return newContext;
    };

    // Start the redirect handling process
    return handleRedirect(context);
  };
};

// --- Header Middleware ---
export const header = (name: string, value: string): Middleware => {
  return (next) => (context) => {
    context.headers[name] = value;
    return next(context);
  };
};

// --- JSON Middleware ---
export const json = (object: any): Middleware => {
  return body(JSON.stringify(object), "application/json");
};

// --- Params Middleware ---
export const params = (data: Record<string, any>): Middleware => {
  return (next) => (context) => {
    const url = new URL(context.url);
    Object.entries(data).forEach(([key, value]) => url.searchParams.append(key, String(value)));
    context.url = url.toString();
    return next(context);
  };
};

// --- Error Handling Middleware ---
export const fallback = (handler: (error: any, context: Context) => Context): Middleware => {
  return (next) => (context) => {
    try {
      return next(context);
    } catch (error) {
      return handler(error, context);
    }
  };
};

// --- Logging Middleware ---
export const logging = (logger: (message: string) => void = console.log): Middleware => {
  return (next) => (context) => {
    logger(`Request: ${context.method} ${context.url}`);
    context = next(context);
    logger(`Response: ${context.response?.status || "No Response"} ${context.url}`);
    return context;
  };
};

// --- Caching Middleware ---
const cache = new Map<string, Response>();
export const caching = (): Middleware => {
  return (next) => (context) => {
    const cacheKey = `${context.method}:${context.url}`;
    if (context.method === "GET" && cache.has(cacheKey)) {
      context.response = cache.get(cacheKey)!.clone();
      return context;
    }
    context = next(context);
    if (context.method === "GET" && context.response?.ok) {
      cache.set(cacheKey, context.response.clone());
    }
    return context;
  };
};

// --- Timeout Middleware ---
export const timeout = (ms: number): Middleware => {
  return (next) => (context: Context) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), ms);

    // Combine existing signal with timeout signal
    const combinedSignal = context['signal']
      ? (AbortSignal as any).any([context['signal'], controller.signal])
      : controller.signal;

    context['signal'] = combinedSignal;

    try {
      const response = next(context);
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


export const createHttpClient = (
): HttpClient => {
  const defaultHeaders = { "Content-Type": "application/json" };
  const middlewares: Middleware[] = [];

  const resolveUrl = (url: string, params?: Record<string, string>): string => {
    const fullUrl =
      url.startsWith("http://") || url.startsWith("https://")
        ? url
        : new URL(url).toString();

    if (params) {
      const urlObj = new URL(fullUrl);
      Object.entries(params).forEach(([key, value]) =>
        urlObj.searchParams.append(key, value)
      );
      return urlObj.toString();
    }

    return fullUrl;
  };

  // Chain middlewares that work with context
  const chainMiddleware = (middlewares: Middleware[]): Middleware => {
    return middlewares.reduceRight(
      (nextMiddleware, middleware) => {
        return (next) => {
          // Apply the current middleware to a function that will call the next middleware
          return middleware((ctx) => nextMiddleware(next)(ctx));
        };
      },
      (next) => next // The base case just calls the final next function
    );
  };

  const request = (method: string, url: string, options: HttpOptions = {}): ResponseParser => {
    const abortController = new AbortController();

    // Create initial context - the context should contain the requestInit properties
    let context: Context = {
      url,
      method,
      headers: { ...defaultHeaders, ...options.headers },
      body: options.body,
      credentials: options.withCredentials ? "include" : "same-origin",
      signal: abortController.signal,
      abortController: abortController,
    };

    // If there are middlewares to apply
    if (middlewares && middlewares.length > 0) {
      // Create a composed middleware from the array
      const composedMiddleware = chainMiddleware(middlewares);

      // Execute the middleware chain with an identity function as the final handler
      const executeRequest = composedMiddleware((ctx) => ctx);

      // Get the final context after middleware processing
      context = executeRequest(context);
    }

    // Create Request object
    context.request = new Request(resolveUrl(context.url, options.params), {
      method: context.method,
      headers: context.headers,
      body: context.body,
      credentials: context['credentials'],
      signal: context['signal']
  });

    // Execute the fetch request with the final context
    const response = fetch(context.request);
    context['promise'] = response;

    // Create a response parser to process the response
    return createResponseParser(context);
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

const createResponseParser = (context: Context): ResponseParser => {
  const parseStream = (parseMethod: string): HttpStream => {
    async function* streamGenerator() {
      try {
        const response = await context['promise']; context.response = response;
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

    const stream = createStream("httpStream", streamGenerator) as HttpStream;
    stream.abort = () => context['abortController'].abort();
    return stream;
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
    arrayBuffer: () => parseStream("arrayBuffer"),
    blob: () => parseStream("blob"),
    json: <T>() => parseStream("json") as HttpStream<T>,
    text: () => parseStream("text"),
    readChunks: <T>() => parseStream("readChunks") as HttpStream<T>,
    readFull: <T>() => parseStream("readFull") as HttpStream<T>,
  };
};

