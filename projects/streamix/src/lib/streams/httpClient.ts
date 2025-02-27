import { createEmission, createStream, Stream } from '../abstractions';
import { concatMap } from '../operators';
import { fromPromise } from './fromPromise';

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
  response?: Response;
  fetch?: Function;
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
 * @returns {HttpStream<T>} The parsed HTTP stream.
 */
export type ParserFunction<T = any> = (response: Response) => HttpStream<T>;

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
    return next(context);
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
 * Sets the Authorization header with an OAuth token.
 * @param token The OAuth token to use for authorization.
 * @returns A middleware function.
 */
export const oauthToken = (token: string): Middleware => {
  return (next) => async (context) => {
    context.headers['Authorization'] = `Bearer ${token}`;
    return await next(context);
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
    let originalRedirectResponse: Response | null = null; // Store original redirect response

    const handleRedirect = async (context: Context): Promise<Context> => {
      if (redirectCount >= maxRedirects) {
        throw new Error('Too many redirects');
      }

      const newContext = await next(context);
      const response: Response = newContext.response!;

      if ([301, 302, 303, 307, 308].includes(response.status)) {
        if (!originalRedirectResponse) {
          originalRedirectResponse = response;
        }

        const location = response.headers.get('Location');
        if (!location) {
          throw new Error('Redirect response missing Location header');
        }

        newContext.url = new URL(location, newContext.url).toString();

        if (response.status === 303) {
          newContext.method = 'GET';
          newContext.body = undefined;
        }

        redirectCount++;
        return handleRedirect(newContext);
      }

      return newContext;
    };

    const finalContext = await handleRedirect(context);

    if (originalRedirectResponse) {
      finalContext.response = originalRedirectResponse; // Set the original redirect response
      finalContext['redirected'] = true;
    }

    return finalContext;
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
      `Response: ${context.response?.status || 'No Response'} ${context.url}`,
    );
    return context;
  };
};

/**
 * Caches GET requests.
 * @returns A middleware function.
 */
export const caching = (): Middleware => {
  const cache = new Map<string, Response>();
  return (next) => async (context) => {
    const cacheKey = `${context.method}:${context.url}`;
    if (context.method === 'GET' && cache.has(cacheKey)) {
      context.response = cache.get(cacheKey)!.clone();
      return context;
    }
    context = await next(context);
    if (context.method === 'GET' && context.response?.ok) {
      cache.set(cacheKey, context.response.clone());
    }
    return context;
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
      const response = await next(context);
      clearTimeout(timeoutId);
      return response;
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
 *     oauthToken("your-oauth-token"),
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
 *     for await (const value of responseStream) {
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
 *     for await (const value of responseStream) {
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
    return middlewares.reduceRight(
      (nextMiddleware, middleware) => {
        return (next) => middleware((ctx) => nextMiddleware(next)(ctx));
      },
      () => async (context) => {
        let body = context.body;

        if (typeof body === 'object' && body !== null) {
          if (body instanceof FormData || body instanceof URLSearchParams) {
            // FormData or URLSearchParams: Use directly
          } else if (context.headers['Content-Type'] === 'application/json') {
            body = JSON.stringify(body);
          }
        }

        const request = new Request(resolveUrl(context.url, context.params), {
          method: context.method,
          headers: context.headers,
          body,
          credentials: context['credentials'],
          signal: context['signal'],
        });
        const response = await (context.fetch ?? fetch)(request);
        context['response'] = response;
        return context;
      },
    );
  };

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
    options: HttpOptions = {},
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
    };

    let promise = chainMiddleware(middlewares)(async (ctx) => ctx)(context);

    let stream = fromPromise(promise).pipe(
      concatMap<Context, T>((ctx) => parser(ctx.response!)),
    ) as HttpStream<T>;
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
 * Parses a Response object into an HttpStream, handling different content types and parsing methods.
 * @template T The type of the parsed data.
 * @param response The Response object to parse.
 * @param parseMethod The parsing method to use (e.g., 'json', 'text', 'readChunks').
 * @returns An HttpStream of parsed data.
 */
const parseStream = <T = any>(
  response: Response,
  parseMethod: string,
): HttpStream<T> => {
  async function* streamGenerator() {
    try {
      if (!response.ok)
        throw new Error(`Request failed with status ${response.status}`);

      const contentType = response.headers.get('Content-Type') || '';
      const isTextResponse =
        contentType.includes('text') || contentType.includes('json');
      const isNdjson = contentType.includes('x-ndjson');
      const isBinaryResponse = !isTextResponse && !isNdjson;

      let encoding = 'utf-8';
      const match = contentType.match(/charset=([^;]+)/);
      if (match) encoding = match[1].trim().toLowerCase();

      const contentLength = response.headers.get('Content-Length');
      const totalSize = contentLength ? parseInt(contentLength, 10) : null;

      if (!response.body) {
        yield createEmission({
          value: await handleRegularResponse(response, parseMethod),
        });
        return;
      }

      if (isBinaryResponse) {
        yield* handleBinaryResponse(response, parseMethod, totalSize);
      } else {
        yield* handleTextResponse(
          response,
          parseMethod,
          isNdjson,
          encoding,
          totalSize,
        );
      }
    } catch (error: any) {
      yield createEmission({ error: error.message });
    }
  }

  return createStream('httpStream', streamGenerator) as HttpStream<T>;
};

/**
 * Handles non-stream (small) responses.
 * @param response The Response object.
 * @param parseMethod The parsing method to use.
 * @returns A Promise that resolves with the parsed data.
 */
async function handleRegularResponse(
  response: Response,
  parseMethod: string,
): Promise<any> {
  switch (parseMethod) {
    case 'json':
      return await response.json();
    case 'text':
      return await response.text();
    case 'arrayBuffer':
    case 'readFull':
      return new Uint8Array(await response.arrayBuffer());
    case 'blob':
      return await response.blob();
    default:
      throw new Error(`Unsupported parse method: ${parseMethod}`);
  }
}

/**
 * Handles binary stream responses.
 * @param response The Response object.
 * @param parseMethod The parsing method to use.
 * @param totalSize The total size of the response, if available.
 * @returns An AsyncGenerator that yields parsed binary data.
 */
async function* handleBinaryResponse(
  response: Response,
  parseMethod: string,
  totalSize: number | null,
) {
  const reader = response.body!.getReader();
  let loaded = 0;
  let chunks: Uint8Array[] = [];

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;

    if (value) {
      loaded += value.length;
      const progress = totalSize ? loaded / totalSize : 0.5;

      if (parseMethod === 'readChunks') {
        yield createEmission({
          value: { chunk: value, progress, done: false },
        });
      } else {
        chunks.push(value);
      }
    }
  }

  if (parseMethod === 'readChunks') {
    yield createEmission({ value: { chunk: null, progress: 1, done: true } });
  } else {
    const fullResponse = chunks.length
      ? new Uint8Array(
          chunks.reduce((acc, chunk) => [...acc, ...chunk], [] as any[]),
        )
      : new Uint8Array(0);

    yield createEmission({ value: fullResponse });
  }
}

/**
 * Handles text-based stream responses.
 * @param response The Response object.
 * @param parseMethod The parsing method to use.
 * @param isNdjson Whether the response is NDJSON.
 * @param encoding The encoding of the text response.
 * @param totalSize The total size of the response, if available.
 * @returns An AsyncGenerator that yields parsed text data.
 */
async function* handleTextResponse(
  response: Response,
  parseMethod: string,
  isNdjson: boolean,
  encoding: string,
  totalSize: number | null,
) {
  const reader = response.body!.getReader();
  const decoder = new TextDecoder(encoding);
  let loaded = 0;
  let ndjsonBuffer = '';
  let fullResponse: any = isNdjson ? [] : '';

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;

    if (value) {
      loaded += value.length;
      const progress = totalSize ? loaded / totalSize : 0.5;
      const chunk = decoder.decode(value, { stream: true });

      if (parseMethod === 'readChunks') {
        if (isNdjson) {
          ndjsonBuffer += chunk;
          const lines = ndjsonBuffer.split('\n');
          ndjsonBuffer = lines.pop() || '';

          for (const line of lines) {
            if (line.trim()) {
              try {
                yield createEmission({
                  value: { chunk: JSON.parse(line), progress, done: false },
                });
              } catch (error) {
                console.warn('Invalid NDJSON line:', error);
              }
            }
          }
        } else {
          yield createEmission({ value: { chunk, progress, done: false } });
        }
      } else {
        if (isNdjson) {
          fullResponse.push(...chunk.split('\n').filter((line) => line.trim()));
        } else {
          fullResponse += chunk;
        }
      }
    }
  }

  if (isNdjson && ndjsonBuffer.trim()) {
    const lines = ndjsonBuffer.split('\n').filter((line) => line.trim());

    for (const line of lines) {
      try {
        const progress = totalSize ? loaded / totalSize : 0.5;

        yield createEmission({
          value: { chunk: JSON.parse(line), progress, done: false },
        });
      } catch (error: any) {
        console.warn('Invalid final NDJSON line:', error);
      }
    }
  }

  if (parseMethod === 'readChunks') {
    yield createEmission({ value: { chunk: null, progress: 1, done: true } });
  } else {
    let finalValue = fullResponse as string;
    if (parseMethod === 'json') {
      try {
        finalValue = JSON.parse(finalValue);
      } catch (error) {
        console.warn('Invalid JSON response:', error);
      }
    }
    yield createEmission({ value: finalValue });
  }
}

/**
 * Parses a Response object as JSON.
 * @template T The type of the parsed JSON data.
 * @param response The Response object to parse.
 * @returns An HttpStream of parsed JSON data.
 */
export const readJson: ParserFunction = <T = any>(response: Response) => {
  return parseStream<T>(response, 'json');
};

/**
 * Parses a Response object as text.
 * @param response The Response object to parse.
 * @returns An HttpStream of parsed text data.
 */
export const readText: ParserFunction<string> = (response: Response) => {
  return parseStream<string>(response, 'text');
};

/**
 * Parses a Response object as an ArrayBuffer.
 * @param response The Response object to parse.
 * @returns An HttpStream of parsed ArrayBuffer data.
 */
export const readArrayBuffer: ParserFunction<ArrayBuffer> = (
  response: Response,
) => {
  return parseStream<ArrayBuffer>(response, 'arrayBuffer');
};

/**
 * Parses a Response object as a Blob.
 * @param response The Response object to parse.
 * @returns An HttpStream of parsed Blob data.
 */
export const readBlob: ParserFunction<Blob> = (response: Response) => {
  return parseStream<Blob>(response, 'blob');
};

/**
 * Parses a Response object as chunks of data.
 * @template T The type of the chunks.
 * @param response The Response object to parse.
 * @returns An HttpStream of chunks.
 */
export const readChunks: ParserFunction = <T = any>(response: Response) => {
  return parseStream<T>(response, 'readChunks');
};

/**
 * Parses a Response object as a single, full data object.
 * @template T The type of the full data object.
 * @param response The Response object to parse.
 * @returns An HttpStream containing the full parsed data object.
 */
export const readFull: ParserFunction = <T = any>(response: Response) => {
  return parseStream<T>(response, 'readFull');
};
