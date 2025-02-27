import { createEmission, createStream, Stream } from "../abstractions";
import { map } from "../operators";
import { fromPromise } from "./fromPromise";

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
  [key: string]: any;
};

export type Middleware = (
  next: (context: Context) => Promise<Context>
) => (context: Context) => Promise<Context>;

export type ParserFunction<T = any> = (response: Response) => HttpStream<T>;

export type HttpClient = {
  use(this: HttpClient, ...middlewares: Middleware[]): HttpClient;
  get(url: string, parser: ParserFunction, options?: HttpOptions): HttpStream;
  post(url: string, parser: ParserFunction, options?: HttpOptions): HttpStream;
  put(url: string, parser: ParserFunction, options?: HttpOptions): HttpStream;
  patch(url: string, parser: ParserFunction, options?: HttpOptions): HttpStream;
  delete(url: string, parser: ParserFunction, options?: HttpOptions): HttpStream;
};

// --- Base Middleware ---
export const base = (baseUrl: string): Middleware => {
  return (next) => async (context: Context) => {
    const url = context.url.startsWith('http://') || context.url.startsWith('https://')
      ? context.url // If already absolute, use it directly
      : new URL(context.url, baseUrl).toString();

    context.url = url;
    return await next(context);
  };
};

// --- Accept Middleware ---
export const accept = (contentType: string): Middleware => {
  return (next) => async (context) => {
    context.headers["Accept"] = contentType;
    return await next(context);
  };
};

// --- Auth Middleware ---
export const oauthToken = (token: string): Middleware => {
  return (next) => async (context) => {
    context.headers["Authorization"] = `Bearer ${token}`;
    return await next(context);
  };
};

// --- Body Middleware ---
export const body = (content: any, contentType: string): Middleware => {
  return (next) => async (context) => {
    context.body = content;
    context.headers["Content-Type"] = contentType;
    return await next(context);
  };
};

// --- Redirect Middleware ---
export const redirect = (maxRedirects: number = 5): Middleware => {
  return (next) => async (context) => {
    let redirectCount = 0;

    const handleRedirect = async (context: Context): Promise<Response> => {
      if (redirectCount >= maxRedirects) {
        throw new Error("Too many redirects");
      }

      const newContext = await next(context);

      if (!newContext['promise']) {
        throw new Error("No response promise returned from middleware");
      }

      const response: Response = await newContext['promise'];
      newContext.response = response;

      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const location = response.headers.get("Location");
        if (!location) {
          throw new Error("Redirect response missing Location header");
        }

        newContext.url = new URL(location, newContext.url).toString();

        if (response.status === 303) {
          newContext.method = "GET";
          newContext.body = undefined;
        }

        redirectCount++;
        return handleRedirect(newContext);
      }

      return response;
    };

    return {
      ...context,
      promise: handleRedirect(context),
    };
  };
};

// --- Header Middleware ---
export const header = (name: string, value: string): Middleware => {
  return (next) => async (context) => {
    context.headers[name] = value;
    return await next(context);
  };
};

// --- JSON Middleware ---
export const json = (object: any): Middleware => {
  return body(JSON.stringify(object), "application/json");
};

// --- Params Middleware ---
export const params = (data: Record<string, any>): Middleware => {
  return (next) => async (context) => {
    const url = new URL(context.url);
    Object.entries(data).forEach(([key, value]) => url.searchParams.append(key, String(value)));
    context.url = url.toString();
    return await next(context);
  };
};

// --- Error Handling Middleware ---
export const fallback = (handler: (error: any, context: Context) => Context): Middleware => {
  return (next) => async (context) => {
    try {
      return await next(context);
    } catch (error) {
      return handler(error, context);
    }
  };
};

// --- Logging Middleware ---
export const logging = (logger: (message: string) => void = console.log): Middleware => {
  return (next) => async (context) => {
    logger(`Request: ${context.method} ${context.url}`);
    context = await next(context);
    logger(`Response: ${context.response?.status || "No Response"} ${context.url}`);
    return context;
  };
};

// --- Caching Middleware ---
const cache = new Map<string, Response>();
export const caching = (): Middleware => {
  return (next) => async (context) => {
    const cacheKey = `${context.method}:${context.url}`;
    if (context.method === "GET" && cache.has(cacheKey)) {
      context.response = cache.get(cacheKey)!.clone();
      return context;
    }
    context = await next(context);
    if (context.method === "GET" && context.response?.ok) {
      cache.set(cacheKey, context.response.clone());
    }
    return context;
  };
};

// --- Timeout Middleware ---
export const timeout = (ms: number): Middleware => {
  return (next) => async (context: Context) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), ms);

    // Combine existing signal with timeout signal
    const combinedSignal = context['signal']
      ? (AbortSignal as any).any([context['signal'], controller.signal])
      : controller.signal;

    context['signal'] = combinedSignal;

    try {
      const response = await next(context);
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

  // Chain middlewares that work with context
  const chainMiddleware = (middlewares: Middleware[]): Middleware => {
    return middlewares.reduceRight((nextMiddleware, middleware) => {
      return (next) => middleware((ctx) => nextMiddleware(next)(ctx));
    }, () => async (context) => {
      // Final middleware to perform the fetch
      const request = new Request(context.url, {
        method: context.method,
        headers: context.headers,
        body: context.body,
        credentials: context['credentials'],
        signal: context['signal']
      });
      const response = await fetch(request);
      context['response'] = response;
      return context;
    });
  };

  const request = (method: string, url: string, parser: ParserFunction, options: HttpOptions = {}): HttpStream => {
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
    let response = (middlewares && middlewares.length > 0)
      ? chainMiddleware(middlewares)(async (ctx) => ctx)(context)
      : Promise.resolve(context);

    // Create a response parser to process the response
    let stream = fromPromise(response).pipe(map(response => parser(response))) as HttpStream;
    stream.abort = () => abortController.abort();
    return stream;
  };

  return {
    use: function (this: HttpClient, ...newMiddlewares: Middleware[]) {
      middlewares.push(...newMiddlewares);
      return this;
    },
    get: (url: string, parser: ParserFunction, options?: HttpOptions): HttpStream =>
      request("GET", url, parser, options),
    post: (url: string, parser: ParserFunction, options?: HttpOptions): HttpStream =>
      request("POST", url, parser, options),
    put: (url: string, parser: ParserFunction, options?: HttpOptions): HttpStream =>
      request("PUT", url, parser, options),
    patch: (url: string, parser: ParserFunction, options?: HttpOptions): HttpStream =>
      request("PATCH", url, parser, options),
    delete: (url: string, parser: ParserFunction, options?: HttpOptions): HttpStream =>
      request("DELETE", url, parser, options)
  };
};

const parseStream = <T>(response: Response, parseMethod: string): HttpStream<T> => {
  async function* streamGenerator() {
    try {
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

  return createStream("httpStream", streamGenerator) as HttpStream<T>;
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

export const readJson = <T = any>(): ParserFunction<T> => (response) => {
  return parseStream<T>(response, 'json');
};

export const readText: ParserFunction<string> = (response) => {
  return parseStream<string>(response, 'text');
};

export const readArrayBuffer: ParserFunction<ArrayBuffer> = (response) => {
  return parseStream<ArrayBuffer>(response, 'arrayBuffer');
};

export const readBlob: ParserFunction<Blob> = (response) => {
  return parseStream<Blob>(response, 'blob');
};

export const readChunks = <T = any>(): ParserFunction<T> => (response) => {
  return parseStream<T>(response, 'readChunks');
};

export const readFull = <T = any>(): ParserFunction<T> => (response) => {
  return parseStream<T>(response, 'readFull');
};
