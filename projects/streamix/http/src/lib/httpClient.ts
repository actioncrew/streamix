import { createReplaySubject, createStream, Stream } from '@actioncrew/streamix';

/**
 * Represents a stream of HTTP responses.
 * @template T
 * @extends {Stream<T>}
 */
export type HttpStream<T = any> = Stream<T> & { abort: () => void };

/**
 * HTTP request options.
 */
export type HttpOptions = {
  headers?: Record<string, string>;
  params?: Record<string, string>;
  withCredentials?: boolean;
  body?: any;
};

/**
 * Represents the HTTP request context.
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
 * Middleware function for modifying HTTP request context.
 * @callback Middleware
 * @param {function(Context): Promise<Context>} next - The next middleware in the chain.
 * @returns {function(Context): Promise<Context>} The modified middleware function.
 */
export type Middleware = (
  next: (context: Context) => Promise<Context>,
) => (context: Context) => Promise<Context>;

/**
 * Function to parse the HTTP response.
 * @template T
 * @callback ParserFunction
 * @param {Response} response - The HTTP response object.
 * @returns {Stream<T>} The parsed HTTP stream.
 */
export type ParserFunction<T = any> = (response: Response) => AsyncIterable<T>;

/**
 * HTTP Client for making requests with middleware support.
 */
export type HttpClient = {
  /**
   * Adds middleware functions to the HTTP client.
   * @param {...Middleware} middlewares - The middleware functions to add.
   * @returns {HttpClient} The updated HTTP client instance.
   */
  use(this: HttpClient, ...middlewares: Middleware[]): HttpClient;

  /**
   * Performs an HTTP GET request.
   * @template T
   * @param {string} url - The request URL.
   * @param {ParserFunction<T>} parser - The response parser function.
   * @param {HttpOptions} [options] - Additional request options.
   * @returns {HttpStream<T>} The HTTP response stream.
   */
  get<T = any>(
    url: string,
    parser: ParserFunction<T>,
    options?: HttpOptions,
  ): HttpStream<T>;

  /**
   * Performs an HTTP POST request.
   * @template T
   * @param {string} url - The request URL.
   * @param {ParserFunction<T>} parser - The response parser function.
   * @param {HttpOptions} [options] - Additional request options.
   * @returns {HttpStream<T>} The HTTP response stream.
   */
  post<T = any>(
    url: string,
    parser: ParserFunction<T>,
    options?: HttpOptions,
  ): HttpStream<T>;

  /**
   * Performs an HTTP PUT request.
   * @template T
   * @param {string} url - The request URL.
   * @param {ParserFunction<T>} parser - The response parser function.
   * @param {HttpOptions} [options] - Additional request options.
   * @returns {HttpStream<T>} The HTTP response stream.
   */
  put<T = any>(
    url: string,
    parser: ParserFunction<T>,
    options?: HttpOptions,
  ): HttpStream<T>;

  /**
   * Performs an HTTP PATCH request.
   * @template T
   * @param {string} url - The request URL.
   * @param {ParserFunction<T>} parser - The response parser function.
   * @param {HttpOptions} [options] - Additional request options.
   * @returns {HttpStream<T>} The HTTP response stream.
   */
  patch<T = any>(
    url: string,
    parser: ParserFunction<T>,
    options?: HttpOptions,
  ): HttpStream<T>;

  /**
   * Performs an HTTP DELETE request.
   * @template T
   * @param {string} url - The request URL.
   * @param {ParserFunction<T>} parser - The response parser function.
   * @param {HttpOptions} [options] - Additional request options.
   * @returns {HttpStream<T>} The HTTP response stream.
   */
  delete<T = any>(
    url: string,
    parser: ParserFunction<T>,
    options?: HttpOptions,
  ): HttpStream<T>;
};

/**
 * Creates a middleware function that sets a custom fetch function within a context object.
 * @param {function} customFetch - The custom fetch function to set in the context.
 * @returns A middleware function.
 */
export const custom = (customFetch: Function): Middleware => {
  return (next) => async (context: Context) => {
    context.fetch = customFetch;
    return await next(context);
  };
}

/**
 * Resolves relative URLs against a base URL.
 * @param baseUrl The base URL to resolve relative URLs against.
 * @returns A middleware function.
 */
export const base = (baseUrl: string): Middleware => {
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
 * Sets the Accept header for the request.
 * @param contentType The content type to set in the Accept header.
 * @returns A middleware function.
 */
export const accept = (contentType: string): Middleware => {
  return (next) => async (context) => {
    context.headers['Accept'] = contentType;
    return await next(context);
  };
};

/**
 * Handles OAuth 2.0 authentication and token refresh.
 * @param config Configuration for token retrieval and refresh.
 * @returns A middleware function.
 */
export const oauth = ({
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
 * Handles HTTP redirects.
 * @param maxRedirects The maximum number of redirects to follow. Defaults to 5.
 * @returns A middleware function.
 */
export const redirect = (maxRedirects: number = 5): Middleware => {
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
 * @param name The header name.
 * @param value The header value.
 * @returns A middleware function.
 */
export const header = (name: string, value: string): Middleware => {
  return (next) => async (context) => {
    context.headers[name] = value;
    return await next(context);
  };
};

/**
 * Appends query parameters to the request URL.
 * @param data The query parameters as a key-value object.
 * @returns A middleware function.
 */
export const params = (data: Record<string, any>): Middleware => {
  return (next) => async (context) => {
    context.params = { ...data, ...context.params };
    return await next(context);
  };
};

/**
 * Handles errors thrown by the next middleware in the chain.
 * @param handler The error handler function.
 * @returns A middleware function.
 */
export const fallback = (
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
 * @param logger The logger function. Defaults to console.log.
 * @returns A middleware function.
 */
export const logging = (
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
 * Caches GET requests.
 * @returns A middleware function.
 */
export const caching = (): Middleware => {
  return (next) => async (context) => {
    context['cache'] = context['cache'] || new Map<string, Promise<Stream>>();
    return await next(context);
  };
};

/**
 * Sets a timeout for the request.
 * @param ms The timeout in milliseconds.
 * @returns A middleware function.
 */
export const timeout = (ms: number): Middleware => {
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
 * @returns {HttpClient} An instance of the HTTP client.
 *
 * @example
 * ```typescript
 * async function fetchData() {
 *   const client = createHttpClient().use(
 *     base("https://api.example.com"),
 *     accept("application/json"),
 *     logging(),
 *     timeout(5000),
 *     fallback((error, context) => {
 *       console.error("Request failed:", error);
 *       return context;
 *     })
 *   );
 *
 *   const responseStream = client.get("/data", readJson);
 *
 *   try {
 *     for await (const emission of responseStream) {
 *       console.log("Received data:", emission.value);
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
 *     base("https://api.example.com"),
 *     logging(),
 *     fallback((error, context) => {
 *       console.error("Post request failed:", error);
 *       return context;
 *     })
 *   );
 *
 *   const responseStream = client.post("/items");
 *
 *   try {
 *     for await (const emission of responseStream) {
 *       console.log("Post response:", emission.value);
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
   * @param {string} url - The base URL.
   * @param {Record<string, string>} [params] - Query parameters to append.
   * @returns {string} The resolved URL with query parameters.
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
   * @param {Middleware[]} middlewares - The list of middleware functions.
   * @returns {Middleware} A composed middleware function.
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
      const cache = context['cache'] ?? null;
      const method = context.method;
      
      // **Check cache before making a request**
      if (method === 'GET' && cache) {
        const cachedData = cache.get(url);
        if (cachedData) {
          context.data = cachedData; // Return cached stream immediately
          return context;
        }
      }

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

      const data = cache && method === 'GET' && cache.get(url) 
        ? cache.get(url) 
        : createReplaySubject();

      if (cache && method === 'GET' && !cache.has(url)) {
        cache.set(url, data);
      } else if (cache && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
        cache.clear();
      }

      (async () => {
        try {
          for await (const item of parser(response)) {
            data.next(item);
          }
        } catch (error) {
          if (cache && method === 'GET') {
            cache.delete(url);
          }
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
   * @template T
   * @param {string} method - The HTTP method.
   * @param {string} url - The request URL.
   * @param {ParserFunction<T>} parser - The response parser.
   * @param {HttpOptions} [options] - Additional request options.
   * @returns {HttpStream<T>} A stream of parsed response data.
   */
  const request = <T = any>(
    method: string,
    url: string,
    parser: ParserFunction<T>,
    options: HttpOptions = {}
  ): HttpStream<T> => {
    const abortController = new AbortController();

    let context: Context = {
      url,
      method,
      headers: { ...defaultHeaders, ...options.headers },
      body: options.body,
      params: options.params,
      credentials: options.withCredentials ? 'include' : 'same-origin',
      signal: abortController.signal,
      fetch: globalThis.fetch.bind(globalThis),
      parser
    };

    let promise = chainMiddleware(middlewares)(async (ctx) => ctx)(context);

    const stream = createStream('httpData', async function* () {
      const ctx = await promise;
      yield* await ctx.data!;
    }) as HttpStream<T>;

    stream.abort = () => abortController.abort();
    return stream;
  };


  return {
    use: function (this: HttpClient, ...newMiddlewares: Middleware[]) {
      middlewares.push(...newMiddlewares);
      return this;
    },
    get: <T>(
      url: string,
      parser: ParserFunction<T>,
      options?: HttpOptions,
    ): HttpStream<T> => request<T>('GET', url, parser, options),
    post: <T>(
      url: string,
      parser: ParserFunction<T>,
      options?: HttpOptions,
    ): HttpStream<T> => request<T>('POST', url, parser, options),
    put: <T>(
      url: string,
      parser: ParserFunction<T>,
      options?: HttpOptions,
    ): HttpStream<T> => request<T>('PUT', url, parser, options),
    patch: <T>(
      url: string,
      parser: ParserFunction<T>,
      options?: HttpOptions,
    ): HttpStream<T> => request<T>('PATCH', url, parser, options),
    delete: <T>(
      url: string,
      parser: ParserFunction<T>,
      options?: HttpOptions,
    ): HttpStream<T> => request<T>('DELETE', url, parser, options),
  };
};

/**
 * Parses a Response object as JSON.
 * @template T The type of the parsed JSON data.
 * @returns A function that takes a Response and returns a stream of parsed JSON data.
 */
export const readJson: ParserFunction = async function* <T>(response: Response) {
  const data = await response.json() as T;
  yield data;
};

/**
 * Parses a Response object as text.
 * @returns A function that takes a Response and returns a stream of text data.
 */
export const readText: ParserFunction<string> = async function* (response) {
  const data = await response.text() as string;
  yield data;
};

/**
 * Parses a Response object as an ArrayBuffer.
 * @returns A function that takes a Response and returns a stream of ArrayBuffer data.
 */
export const readArrayBuffer: ParserFunction<ArrayBuffer> = async function* (response) {
  const data = await response.arrayBuffer();
  yield data;
};

/**
 * Parses a Response object as a Blob.
 * @returns A function that takes a Response and returns a stream of Blob data.
 */
export const readBlob: ParserFunction<Blob> = async function* (response) {
  const data = await response.blob();
  yield data;
};

/**
 * Type for the chunks emitted by the readChunks function.
 * @template T The type of the parsed chunk data.
 */
export type ChunkData<T> = {
  chunk: T;
  progress: number;
  done: boolean;
};

/**
 * Reads and processes streamed response chunks based on Content-Type.
 *
 * @template T The expected type of parsed data.
 * @param {(chunk: any) => T} [chunkParser] Optional custom parser function.
 * @returns {ParserFunction<ChunkData<T>>} A function that processes a response stream.
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
 *
 * @param {Uint8Array} chunk - The raw binary chunk.
 * @returns {Uint8Array} The unchanged binary data.
 */
export const readBinaryChunk = (chunk: Uint8Array): Uint8Array => chunk;

/**
 * Decodes a binary chunk into a text string.
 *
 * @param {Uint8Array} chunk - The binary chunk.
 * @param {string} [encoding="utf-8"] - The text encoding format.
 * @returns {string} The decoded text.
 */
export const readTextChunk = (chunk: Uint8Array, encoding: string = "utf-8"): string =>
  new TextDecoder(encoding).decode(chunk);

/**
 * Parses a binary chunk as JSON.
 *
 * @param {string} chunk - The text chunk containing JSON data.
 * @returns {any} The parsed JSON object.
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
 *
 * @param {string} line - A single JSON line from NDJSON.
 * @returns {any} The parsed JSON object, or `null` if parsing fails.
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
 *
 * @param {Uint8Array} chunk - The binary chunk to encode.
 * @returns {string} The Base64-encoded string.
 */
export const readBase64Chunk = (chunk: Uint8Array): string =>
  btoa(String.fromCharCode(...chunk));

/**
 * Parses a text chunk as CSV data.
 *
 * @param {string} chunk - The text chunk containing CSV data.
 * @returns {string[][]} A 2D array representing CSV rows and columns.
 */
export const readCsvChunk = (chunk: string): string[][] => {
  return chunk.split("\n").map((line) => line.split(","));
};

/**
 * Gets the encoding from a Content-Type header.
 * @param contentType The Content-Type header value.
 * @returns The encoding string.
 */
function getEncoding(contentType: string): string {
  const match = contentType.match(/charset=([^;]+)/);
  return match ? match[1].trim().toLowerCase() : 'utf-8';
}

/**
 * Reads and collects the entire response body from a ReadableStream.
 * This function returns a stream that yields the full data as it's read.
 *
 * @returns {ParserFunction<Uint8Array>} A function that processes a response stream.
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
