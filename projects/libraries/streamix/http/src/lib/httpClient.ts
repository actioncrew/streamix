import { createReplaySubject, createStream, eachValueFrom, Stream } from '@actioncrew/streamix';

/**
 * Represents a stream of HTTP responses.
 *
 * This is a special type of stream that includes a method to abort the
 * underlying HTTP request, providing control over long-running or cancellable
 * operations.
 */
export type HttpStream<T = any> = Stream<T> & { abort: () => void };

/**
 * HTTP request options.
 *
 * This object defines the configuration for an HTTP request, including
 * headers, URL parameters, body content, and credentials.
 */
export type HttpOptions = {
  headers?: Record<string, string>;
  params?: Record<string, string>;
  withCredentials?: boolean;
  body?: any;
};

/**
 * Represents the HTTP request context.
 *
 * This object is passed through the middleware chain and contains all
 * relevant information about the request and response lifecycle.
 */
export type Context = {
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: any;
  params?: Record<string, string>;
  fetch?: Function;
  parser: ParserFunction;
  ok?: boolean;
  status?: number;
  statusText?: string;
  redirectTo?: string;
  data?: Stream;
  [key: string]: any;
};

/**
 * A middleware function for modifying the HTTP request context.
 *
 * Middleware functions are composed in a chain, where each middleware
 * can process the `Context` object before passing it to the next function
 * via the `next` parameter.
 */
export type Middleware = (
  next: (context: Context) => Promise<Context>,
) => (context: Context) => Promise<Context>;

/**
 * A function to parse the HTTP response body into a stream of values.
 *
 * A parser takes a `Response` object and returns an `AsyncIterable` that
 * yields the parsed data. This allows for streaming responses and handling
 * various data formats.
 */
export type ParserFunction<T = any> = (response: Response) => AsyncIterable<T>;

/**
 * HTTP Client for making requests with middleware support.
 *
 * This object provides methods for standard HTTP verbs (`get`, `post`, etc.)
 * and a `withDefaults` method to configure the client with a set of middleware
 * functions that will be applied to every request.
 */
export type HttpClient = {
  /**
   * Adds middleware functions to the HTTP client.
   *
   * This method configures the client with default middleware that will be
   * applied to all subsequent requests.
   */
  withDefaults(this: HttpClient, ...middlewares: Middleware[]): HttpClient;

  /**
   * Performs an HTTP GET request.
   */
  get<T = any>(
    url: string,
    options?: HttpOptions | ParserFunction<T>,
    parser?: ParserFunction<T>,
  ): HttpStream<T>;

  /**
   * Performs an HTTP POST request.
   */
  post<T = any>(
    url: string,
    options?: HttpOptions | ParserFunction<T>,
    parser?: ParserFunction<T>,
  ): HttpStream<T>;

  /**
   * Performs an HTTP PUT request.
   */
  put<T = any>(
    url: string,
    options?: HttpOptions | ParserFunction<T>,
    parser?: ParserFunction<T>,
  ): HttpStream<T>;

  /**
   * Performs an HTTP PATCH request.
   */
  patch<T = any>(
    url: string,
    options?: HttpOptions | ParserFunction<T>,
    parser?: ParserFunction<T>,
  ): HttpStream<T>;

  /**
   * Performs an HTTP DELETE request.
   */
  delete<T = any>(
    url: string,
    options?: HttpOptions | ParserFunction<T>,
    parser?: ParserFunction<T>,
  ): HttpStream<T>;
};

/**
 * Creates a middleware function that sets a custom fetch function within a context object.
 *
 * This is useful for mocking HTTP requests in tests or for using a different
 * fetch implementation, such as `node-fetch` in a server environment.
 */
export const useCustom = (customFetch: Function): Middleware => {
  return (next) => async (context: Context) => {
    context.fetch = customFetch;
    return await next(context);
  };
}

/**
 * Resolves relative URLs against a base URL.
 *
 * This middleware is useful for making API requests without repeating the
 * base URL for every call. It will resolve relative paths like `/users/1`
 * against the provided `baseUrl`.
 */
export const useBase = (baseUrl: string): Middleware => {
  return (next) => async (context: Context) => {
    const url =
      context.url.startsWith('http://') || context.url.startsWith('https://')
        ? context.url
        : new URL(context.url, baseUrl).toString();

    context.url = url;
    return await next(context);
  };
};

/**
 * Sets the `Accept` header for the request.
 *
 * This middleware ensures that the request specifies the desired content
 * type for the response, such as `application/json`.
 */
export const useAccept = (contentType: string): Middleware => {
  return (next) => async (context) => {
    context.headers['Accept'] = contentType;
    return await next(context);
  };
};

/**
 * Handles OAuth 2.0 authentication and token refresh.
 *
 * This middleware automatically adds an `Authorization` header to the request
 * with a bearer token. If a 401 Unauthorized response is received, it attempts
 * to refresh the token and retry the request.
 */
export const useOauth = ({
  getToken,
  refreshToken,
  shouldRetry = () => true, // Default to always retry
}: {
  getToken: () => Promise<string>;
  refreshToken: () => Promise<string>;
  shouldRetry?: (context: Context) => boolean;
}): Middleware => {
  return (next) => async (context) => {
    // Set the initial token in the Authorization header
    context.headers["Authorization"] = `Bearer ${await getToken()}`;

    // Attempt the request
    const newContext = await next(context);

    // If unauthorized and shouldRetry allows, refresh the token and retry
    if (newContext.status === 401 && shouldRetry(newContext)) {
      newContext.headers["Authorization"] = `Bearer ${await refreshToken()}`;
      return await next(context); // Retry with the new token
    }

    return newContext;
  };
};

/**
 * Retry middleware for handling transient errors.
 *
 * This middleware automatically retries a failed request, with an exponential
 * backoff delay between attempts. This is useful for handling temporary network
 * failures or flaky API services.
 */
export const useRetry = (
  maxRetries: number = 3,
  backoffBase: number = 1000,
  shouldRetry: (error: any, context: Context) => boolean = () => true,
): Middleware => {
  return (next) => async (context) => {
    let retryCount = 0;

    while (retryCount <= maxRetries) {
      try {
        return await next(context); // Attempt the request
      } catch (error) {
        if (!shouldRetry(error, context)) {
          throw error; // Do not retry if the error is not retryable
        }

        if (retryCount === maxRetries) {
          throw error; // Max retries reached, rethrow the error
        }

        // Calculate exponential backoff delay
        const delay = backoffBase * Math.pow(2, retryCount);
        console.warn(`Retry ${retryCount + 1}/${maxRetries} after ${delay}ms due to error:`, error);

        // Wait for the delay before retrying
        await new Promise((resolve) => setTimeout(resolve, delay));

        retryCount++;
      }
    }

    // This line should never be reached, but TypeScript requires a return statement
    throw new Error('Retry middleware failed unexpectedly');
  };
};

/**
 * Handles HTTP redirects.
 *
 * This middleware automatically follows 3xx redirect responses up to a
 * specified maximum number of times. It updates the URL in the context and
 * handles the change in HTTP method for a 303 See Other redirect.
 */
export const useRedirect = (maxRedirects: number = 5): Middleware => {
  return (next) => async (context) => {
    let redirectCount = 0;

    const handleRedirect = async (context: Context): Promise<Context> => {
      if (redirectCount >= maxRedirects) {
        throw new Error('Too many redirects');
      }

      const newContext = await next(context);

      if(newContext.redirectTo !== undefined) {
        const location = newContext.redirectTo;
        if (!location) {
          throw new Error('Redirect response missing Location header');
        }

        newContext.url = new URL(location, newContext.url).toString();

        if (newContext.status === 303) {
          newContext.method = 'GET';
          newContext.body = undefined;
        }

        redirectCount++;
        return handleRedirect(newContext);
      }

      return await next(newContext);
    };

    return await handleRedirect(context);
  };
};

/**
 * Sets a custom header for the request.
 */
export const useHeader = (name: string, value: string): Middleware => {
  return (next) => async (context) => {
    context.headers[name] = value;
    return await next(context);
  };
};

/**
 * Appends query parameters to the request URL.
 */
export const useParams = (data: Record<string, any>): Middleware => {
  return (next) => async (context) => {
    context.params = { ...data, ...context.params };
    return await next(context);
  };
};

/**
 * Handles errors thrown by the next middleware in the chain.
 *
 * This middleware provides a way to gracefully handle errors without
 * breaking the entire chain. It catches errors and allows you to
 * define a custom fallback behavior.
 */
export const useFallback = (
  handler: (error: any, context: Context) => Context,
): Middleware => {
  return (next) => async (context) => {
    try {
      return await next(context);
    } catch (error) {
      return handler(error, context);
    }
  };
};

/**
 * Logs request and response information.
 */
export const useLogger = (
  logger: (message: string) => void = console.log,
): Middleware => {
  return (next) => async (context) => {
    logger(`Request: ${context.method} ${context.url}`);
    context = await next(context);
    logger(
      `Response: ${context.status || 'No Response'} ${context.url}`,
    );
    return context;
  };
};

/**
 * Sets a timeout for the request.
 *
 * This middleware adds a timeout to the request, automatically aborting it
 * if it takes longer than the specified number of milliseconds.
 */
export const useTimeout = (ms: number): Middleware => {
  return (next) => async (context: Context) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), ms);

    const combinedSignal = context['signal']
      ? (AbortSignal as any).any([context['signal'], controller.signal])
      : controller.signal;

    context['signal'] = combinedSignal;

    try {
      context = await next(context);
      clearTimeout(timeoutId);
      return context;
    } catch (error: any) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        throw new Error('Request timed out');
      }
      throw error;
    }
  };
};

/**
 * Creates an HTTP client with middleware support and streaming capabilities.
 *
 * The client is a factory for creating request streams. Middleware can be
 * configured globally for the client using `withDefaults`.
 *
 * @returns {HttpClient} An instance of the HTTP client.
 *
 * @example
 * ```typescript
 * async function fetchData() {
 *   const client = createHttpClient().withDefaults(
 *     useBase("https://api.example.com"),
 *     useAccept("application/json"),
 *     useLogger(),
 *     useTimeout(5000),
 *     useFallback((error, context) => {
 *       console.error("Request failed:", error);
 *       return context;
 *     })
 *   );
 *
 *   const responseStream = client.get("/data", readJson);
 *
 *   try {
 *     for await (const value of eachValueFrom(responseStream)) {
 *       console.log("Received data:", value);
 *     }
 *   } catch (error) {
 *     console.error("Unexpected error:", error);
 *   }
 * }
 *
 * fetchData();
 *
 * async function postData() {
 *   const client = createHttpClient().use(
 *     useBase("https://api.example.com"),
 *     useLogger(),
 *     useFallback((error, context) => {
 *       console.error("Post request failed:", error);
 *       return context;
 *     })
 *   );
 *
 *   const responseStream = client.post("/items");
 *
 *   try {
 *     for await (const value of eachValueFrom(responseStream)) {
 *       console.log("Post response:", value);
 *     }
 *   } catch (error) {
 *     console.error("Post request error:", error);
 *   }
 * }
 *
 * postData();
 * ```
 */
export const createHttpClient = (): HttpClient => {
  const defaultHeaders = { 'Content-Type': 'application/json' };
  const middlewares: Middleware[] = [];

  /**
   * Resolves the final request URL, adding query parameters if provided.
   */
  const resolveUrl = (url: string, params?: Record<string, string>): string => {
    const fullUrl =
      url.startsWith('http://') || url.startsWith('https://')
        ? url
        : new URL(url).toString();

    if (params) {
      const urlObj = new URL(fullUrl);
      Object.entries(params).forEach(([key, value]) =>
        urlObj.searchParams.append(key, value),
      );
      return urlObj.toString();
    }

    return fullUrl;
  };

  /**
   * Chains middlewares to process the request context before making the request.
   */
  const chainMiddleware = (middlewares: Middleware[]): Middleware => {
    return middlewares.reduceRight((nextMiddleware, middleware) =>
      (next) => (ctx) => middleware(nextMiddleware(next))(ctx),
    () => async (context) => {
      let body = context.body;
      if (typeof body === 'object' && body !== null) {
        if (!(body instanceof FormData || body instanceof URLSearchParams)) {
          if (context.headers['Content-Type'] === 'application/json') {
            body = JSON.stringify(body);
          }
        }
      }

      const url = resolveUrl(context.url, context.params);
      const { method, parser } = context;

      const request = new Request(url, {
        method,
        headers: context.headers,
        body,
        credentials: context['credentials'],
        signal: context['signal'],
      });

      const response = await context.fetch!(request) as Response;

      // Update context with response details
      context.ok = response.ok;
      context.status = response.status;
      context.statusText = response.statusText;

      // Handle redirects
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        context.redirectTo = response.headers.get('Location') || undefined;
        return context;
      }

      // **Handle errors before processing response**
      if (!response.ok) {
        throw new Error(`HTTP Error: ${response.status} ${response.statusText}`);
      }

      const data = createReplaySubject();

      (async () => {
        try {
          for await (const item of parser(response)) {
            data.next(item);
          }
        } catch (error) {
          data.error(error);
        } finally {
          data.complete();
        }
      })();

      context.data = data;
      return context;
    });
  }

  /**
   * Performs an HTTP request using the configured middlewares and streaming.
   */
  const request = <T = any>(
    method: string,
    url: string,
    optionsOrParser?: HttpOptions | ParserFunction<T>,
    maybeParser?: ParserFunction<T>,
  ): HttpStream<T> => {
    const abortController = new AbortController();

    // Determine whether optionsOrParser is the parser or options
    const isParser = typeof optionsOrParser === 'function';

    const options: HttpOptions = isParser ? {} : optionsOrParser || {};
    const parser: ParserFunction<T> = isParser
      ? (optionsOrParser as ParserFunction<T>)
      : (maybeParser ?? (readStatus as ParserFunction<T>));

    const context: Context = {
      url,
      method,
      headers: { ...defaultHeaders, ...options.headers },
      body: options.body,
      params: options.params,
      credentials: options.withCredentials ? 'include' : 'same-origin',
      signal: abortController.signal,
      fetch: globalThis.fetch.bind(globalThis),
      parser,
    };

    const promise = chainMiddleware(middlewares)(async (ctx) => ctx)(context);

    const stream = createStream('httpData', async function* () {
      const ctx = await promise;
      yield* await eachValueFrom(ctx.data!);
    }) as HttpStream<T>;

    stream.abort = () => abortController.abort();
    return stream;
  };

  return {
    withDefaults: function (this: HttpClient, ...newMiddlewares: Middleware[]) {
      middlewares.push(...newMiddlewares);
      return this;
    },
    get: <T>(
      url: string,
      options: HttpOptions,
      parser: ParserFunction<T>,
    ): HttpStream<T> => request<T>('GET', url, options, parser),
    post: <T>(
      url: string,
      options: HttpOptions,
      parser: ParserFunction<T>,
    ): HttpStream<T> => request<T>('POST', url, options, parser),
    put: <T>(
      url: string,
      options: HttpOptions,
      parser: ParserFunction<T>,
    ): HttpStream<T> => request<T>('PUT', url, options, parser),
    patch: <T>(
      url: string,
      options: HttpOptions,
      parser: ParserFunction<T>,
    ): HttpStream<T> => request<T>('PATCH', url, options, parser),
    delete: <T>(
      url: string,
      options: HttpOptions,
      parser: ParserFunction<T>,
    ): HttpStream<T> => request<T>('DELETE', url, options, parser),
  };
};

/**
 * Yields the response status and status text as a single object.
 *
 * This parser ignores the response body and emits the HTTP status metadata only.
 */
export const readStatus: ParserFunction<{ status: number; statusText: string; headers: Record<string, string>; }> =
  async function* (response) {
    const headers: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      headers[key] = value;
    });

    yield {
      status: response.status,
      statusText: response.statusText,
      headers,
    };
  };

/**
 * Parses a Response object as JSON.
 *
 * This is a standard parser function that reads the entire response body,
 * parses it as a JSON object, and then emits that single object.
 */
export const readJson: ParserFunction = async function* <T>(response: Response) {
  const data = await response.json() as T;
  yield data;
};

/**
 **
 * Parses a Response object as text.
 *
 * This parser reads the entire response body as a text string and emits
 * that string as a single value.
 */
export const readText: ParserFunction<string> = async function* (response) {
  const data = await response.text() as string;
  yield data;
};

/**
 * Parses a Response object as an ArrayBuffer.
 *
 * This parser reads the entire response body into an `ArrayBuffer` and
 * emits it as a single value. This is useful for handling binary data.
 */
export const readArrayBuffer: ParserFunction<ArrayBuffer> = async function* (response) {
  const data = await response.arrayBuffer();
  yield data;
};

/**
 * Parses a Response object as a Blob.
 *
 * This parser reads the entire response body into a `Blob` object and
 * emits it as a single value. This is useful for working with files or images.
 */
export const readBlob: ParserFunction<Blob> = async function* (response) {
  const data = await response.blob();
  yield data;
};

/**
 * Type for the chunks emitted by the readChunks function.
 *
 * This object contains a parsed chunk of data, the current progress of the
 * download, and a `done` flag indicating completion.
 */
export type ChunkData<T> = {
  chunk: T;
  progress: number;
  done: boolean;
};

/**
 * Reads and processes streamed response chunks based on Content-Type.
 *
 * This is a versatile parser that can handle a variety of streaming formats,
 * including binary data and line-delimited JSON (NDJSON). It emits chunks
 * as they arrive, along with progress information.
 */
export const readChunks = <T = Uint8Array>(
  chunkParser: (chunk: any) => T = (chunk) => chunk
): ParserFunction<ChunkData<T>> => async function* (response) {
  if (!response.body) {
    throw new Error("Response body is not readable");
  }

  const contentLength = response.headers.get("Content-Length");
  const totalSize = contentLength ? parseInt(contentLength, 10) : null;
  let loaded = 0;

  const reader = response.body.getReader();
  const contentType = response.headers.get("Content-Type") || "";

  let buffer = "";
  const decoder = new TextDecoder(getEncoding(contentType));

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;

    if (value) {
      loaded += value.length;
      const progress = totalSize ? loaded / totalSize : 0.5;

      let parsedChunk;

      if (contentType.includes("text") || contentType.includes("json")) {
        // Convert binary to text
        const chunkText = decoder.decode(value, { stream: true });

        if (contentType.includes("x-ndjson")) {
          // NDJSON: Process line by line
          buffer += chunkText;
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (line.trim()) {
              try {
                parsedChunk = chunkParser(line);
                yield { chunk: parsedChunk, progress, done: false };
              } catch (error) {
                console.warn("Invalid NDJSON line:", line, error);
              }
            }
          }
          continue; // Skip standard yield for NDJSON
        }

        parsedChunk = chunkParser(chunkText);
      } else {
        // Binary/Base64/Other formats
        parsedChunk = chunkParser(value);
      }

      yield {
        chunk: parsedChunk,
        progress,
        done: false,
      };
    }
  }

  // Emit final completion signal
  yield {
    chunk: null as unknown as T,
    progress: 1,
    done: true,
  };
};

/**
 * Parses raw binary chunks (returns Uint8Array as-is).
 */
export const readBinaryChunk = (chunk: Uint8Array): Uint8Array => chunk;

/**
 * Decodes a binary chunk into a text string.
 */
export const readTextChunk = (chunk: Uint8Array, encoding: string = "utf-8"): string =>
  new TextDecoder(encoding).decode(chunk);

/**
 * Parses a binary chunk as JSON.
 */
export const readJsonChunk = (chunk: string): any => {
  try {
    return JSON.parse(chunk);
  } catch {
    console.warn("Invalid JSON chunk:", chunk);
    return null;
  }
};

/**
 * Parses a single NDJSON line.
 */
export const readNdjsonChunk = (line: string): any => {
  try {
    return JSON.parse(line);
  } catch {
    console.warn("Invalid NDJSON line:", line);
    return null;
  }
};

/**
 * Converts a binary chunk to a Base64 string.
 */
export const readBase64Chunk = (chunk: Uint8Array): string =>
  btoa(String.fromCharCode(...chunk));

/**
 * Parses a text chunk as CSV data.
 */
export const readCsvChunk = (chunk: string): string[][] => {
  return chunk.split("\n").map((line) => line.split(","));
};

/**
 * Gets the encoding from a Content-Type header.
 *
 * This utility function extracts the character set from a content-type
 * string, defaulting to `utf-8` if no charset is specified.
 */
function getEncoding(contentType: string): string {
  const match = contentType.match(/charset=([^;]+)/);
  return match ? match[1].trim().toLowerCase() : 'utf-8';
}

/**
 * Reads and collects the entire response body from a `ReadableStream`.
 *
 * This function returns a stream that yields the full data as it's read.
 * It's useful for scenarios where you need the complete response body
 * before processing the data, such as for images or complete files.
 */
export const readFull: ParserFunction<Uint8Array> = async function* (response) {
  if (!response.body) {
    throw new Error("Response body is not readable");
  }

  const reader = response.body.getReader();
  let accumulatedData = new Uint8Array();

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;

    if (value) {
      // Concatenate the new chunk with the accumulated data
      const newData = new Uint8Array(accumulatedData.length + value.length);
      newData.set(accumulatedData);
      newData.set(value, accumulatedData.length);
      accumulatedData = newData;
    }
  }

  // Once all data is collected, yield the full response body as a single chunk
  yield accumulatedData;
};
