import { createEmission, createStream, Emission, Stream } from "../abstractions";

// Type for interceptors
export type RequestInterceptor = (request: Request) => Request | Promise<Request>;
export type ResponseInterceptor = (response: Response) => Response | Promise<Response>;

export type HttpStream<T = any> = Stream<T> & { abort: () => void };

export type HttpConfig = {
  fetchFn?: typeof fetch;
  interceptors?: {
    request?: RequestInterceptor[];
    response?: ResponseInterceptor[];
  };
  withXsrfProtection?: boolean;
  xsrfTokenHeader?: string;
  xsrfToken?: string;
  readInChunks?: boolean;
  useWebWorker?: boolean;
};

export type HttpFetch = (url: string, options?: RequestInit) => HttpStream;

export const initHttp = (config: HttpConfig = {}): HttpFetch => {
  const {
    interceptors = { request: [], response: [] },
    withXsrfProtection = false,
    xsrfTokenHeader = "X-XSRF-TOKEN",
    xsrfToken: configXsrfToken = null,
    readInChunks = false
  } = config;

  // Helper function to get XSRF token from cookies or localStorage
  const getXsrfToken = (): string | null => {
    if (!withXsrfProtection) return null;
    return (
      document.cookie
        .split("; ")
        .find((row) => row.startsWith("XSRF-TOKEN="))
        ?.split("=")[1] || localStorage.getItem("XSRF-TOKEN")
    );
  };

  // Use provided token or try to get it from cookies/localStorage
  const xsrfToken = configXsrfToken || (withXsrfProtection ? getXsrfToken() : null);

  return (url: string, options?: RequestInit): HttpStream => {
    const abortController = new AbortController();

    // For Web Worker implementation
    // Create a new worker with all necessary code included
    const workerCode = `
      self.onmessage = async function(event) {
        const { url, options, interceptors, withXsrfProtection, xsrfTokenHeader, xsrfToken, readInChunks } = event.data;

        try {
          // Define the apply interceptors functions
          async function applyRequestInterceptors(request, interceptors) {
            if (!interceptors.length) return request;

            let currentRequest = request;
            for (const interceptor of interceptors) {
              currentRequest = await interceptor(currentRequest);
            }
            return currentRequest;
          };

          // Apply response interceptors sequentially
          async function applyResponseInterceptors(response, interceptors) {
            if (!interceptors?.length) return response;

            let currentResponse = response;
            for (const interceptor of interceptors) {
              currentResponse = await interceptor(currentResponse);
            }
            return currentResponse;
          };

          // Define fetchWithInterceptors function within worker
          const fetchWithInterceptors = async (request) => {
            try {
              const interceptedRequest = await applyRequestInterceptors(request, interceptors.request);
              const response = await fetch(interceptedRequest);
              return await applyResponseInterceptors(response, interceptors.response);
            } catch (error) {
              if (error.name === "AbortError") {
                return new Response(JSON.stringify({ error: "Request aborted" }), {
                  status: 408,
                });
              }
              return new Response(
                JSON.stringify({ error: \`Request failed: \${error.message}\` }),
                { status: 500 }
              );
            }
          };

          // Setup request
          let headers = new Headers(options?.headers || {});
          let body = null;

          if (options?.body) {
            // Note: FormData won't properly transfer, so we're handling basic cases only
            if (typeof options.body === 'string') {
              body = options.body;
            } else {
              // Assume JSON for objects
              if (!headers.has("Content-Type")) {
                headers.set("Content-Type", "application/json");
              }
              body = JSON.stringify(options.body);
            }
          }

          const requestInit = {
            ...options,
            headers,
            body
          };

          let request = new Request(url, requestInit);

          // Add XSRF token if needed
          if (
            withXsrfProtection &&
            xsrfToken &&
            xsrfTokenHeader &&
            !request.headers.has(xsrfTokenHeader) &&
            !["GET", "HEAD", "OPTIONS"].includes(request.method)
          ) {
            request.headers.set(xsrfTokenHeader, xsrfToken);
          }

          const response = await fetchWithInterceptors(request);

          if (!response.ok) {
            throw new Error(\`Request failed with status \${response.status}\`);
          }

          // Process response based on content type
          const contentType = response.headers.get("Content-Type") || "";
          const isText = contentType.includes("text") || contentType.includes("json");
          const isNdjson = contentType.includes("x-ndjson");

          // Determine encoding
          let encoding = "utf-8";
          const match = contentType.match(/charset=([^;]+)/);
          if (match) encoding = match[1].trim().toLowerCase();

          // Track progress
          const contentLength = response.headers.get("Content-Length");
          const totalSize = contentLength ? parseInt(contentLength, 10) : null;
          let loaded = 0;

          // Handle responses without a body
          if (!response.body) {
            let value;
            if (isText || contentType.includes("application/json")) {
              value = await response.text();
            } else {
              value = new Uint8Array(await response.arrayBuffer());
            }

            self.postMessage({ value });
            return;
          }

          // Stream the response
          const reader = response.body.getReader();
          const decoder = new TextDecoder(encoding);
          let ndjsonBuffer = "";
          let fullResponse = isText ? "" : []; // Collect the full response if not reading in chunks

          while (true) {
            const { value, done } = await reader.read();
            if (done) break;

            loaded += value?.length || 0;
            const progress = totalSize ? loaded / totalSize : 0.5;

            if (readInChunks) {
              if (isNdjson) {
                ndjsonBuffer += decoder.decode(value, { stream: true });
                const lines = ndjsonBuffer.split("\\n");
                ndjsonBuffer = lines.pop() || "";

                for (const line of lines) {
                  if (line.trim()) {
                    self.postMessage({
                      type: "chunk",
                      value: { value: line, progress, done: false },
                    });
                  }
                }
              } else {
                const chunk = isText ? decoder.decode(value, { stream: true }) : value;
                self.postMessage({
                  type: "chunk",
                  value: { value: chunk, progress, done: false },
                });
              }
            } else {
              // Collect the full response data
              if (isText) {
                fullResponse += decoder.decode(value, { stream: true });
              } else {
                fullResponse.push(value);
              }
            }
          }

          // Handle remaining NDJSON data for chunks
          if (isNdjson && readInChunks && ndjsonBuffer.trim()) {
            const lines = ndjsonBuffer.split("\\n").filter(line => line.trim()); // Filter out empty lines
            for (const line of lines) {
              const progress = totalSize ? loaded / totalSize : 0.5;
              self.postMessage({
                type: "chunk",
                value: { value: line, progress, done: false }, // Send each line as a string
              });
            }
          }

          // Emit full response if not reading in chunks
          if (!readInChunks) {
            const result = isText
              ? fullResponse
              : new Uint8Array(fullResponse.flat()); // Flatten the binary array
            self.postMessage({ value: result });
            return;
          }

          // Signal completion if reading in chunks
          if (readInChunks) {
            self.postMessage({
              type: "complete",
              value: { value: null, progress: 1, done: true },
            });
          }
        } catch (error) {
          self.postMessage({ type: 'error', data: error.message });
        }
      };

      // Handle abort messages
      self.addEventListener('message', (e) => {
        if (e.data.type === 'abort') {
          // We can't transfer the AbortController, but we can handle the message
          self.postMessage({ type: 'error', data: 'Request aborted' });
          self.close();
        }
      });
    `;

    const blob = new Blob([workerCode], { type: "application/javascript" });
    const workerUrl = URL.createObjectURL(blob);
    const worker = new Worker(workerUrl);

    // Prepare options for worker
    let workerOptions = { ...options };

    // Convert Headers to plain object for worker
    if (options?.headers instanceof Headers) {
      const headerObj: Record<string, string> = {};
      options.headers.forEach((value, key) => {
        headerObj[key] = value;
      });
      workerOptions.headers = headerObj;
    }

    // Send parameters to worker
    worker.postMessage({
      url,
      options: workerOptions,
      interceptors: {
        request: interceptors.request!.map(fn => fn.toString()),
        response: interceptors.response!.map(fn => fn.toString())
      },
      withXsrfProtection,
      xsrfTokenHeader,
      xsrfToken,
      readInChunks
    });

    // Create generator to handle worker messages
    async function* httpStream(): AsyncGenerator<Emission, void, unknown> {
      let resolveNext: ((value: any) => void) | null = null;
      let rejectNext: ((reason?: any) => void) | null = null;
      let isComplete: boolean = false;

      worker.onmessage = (event: MessageEvent) => {
        if (event.data.value !== undefined) {
          if (resolveNext) {
            resolveNext(event.data.value);
            resolveNext = null;
            isComplete = true;
          }
        } else if (event.data.type === "chunk") {
          if (resolveNext) {
            resolveNext(event.data.value);
            resolveNext = null;
          }
        } else if (event.data.type === "error") {
          if (rejectNext) {
            rejectNext(new Error(event.data.value));
            rejectNext = null;
          }
        } else if (event.data.type === "complete") {
          isComplete = true;
          // Clean up worker
          URL.revokeObjectURL(workerUrl);
          worker.terminate();
          if (resolveNext) {
            resolveNext(undefined); // Signal completion
            resolveNext = null;
          }
        }
      };

      while (!isComplete) {
        try {
          // Wait for the next message from the worker
          const data = await new Promise<any>((resolve, reject) => {
            resolveNext = resolve;
            rejectNext = reject;
          });

          // If the data is undefined, the stream is complete
          if (data === undefined) {
            break;
          }

          if (Array.isArray(data)) {
            // If data is an array of strings, yield each string individually
            for (const item of data) {
              yield createEmission({ value: JSON.parse(item) });
            }
          } else if (typeof data === "string") {
            // If data is a string, parse it as JSON and yield
            yield createEmission({ value: JSON.parse(data) });
          } else if (data instanceof Uint8Array) {
            // If data is binary, yield it directly
            yield createEmission({ value: data });
          } else {
            // Handle unexpected data types
            throw new Error(`Unexpected data type: ${typeof data}`);
          }
        } catch (error) {
          // Clean up worker on error
          isComplete = true;
          throw error;
        }
      }

      // Final cleanup
      URL.revokeObjectURL(workerUrl);
      worker.terminate();
    }

    const stream = createStream("fetch", httpStream) as HttpStream;

    // Implement abort method
    stream.abort = () => {
      worker.postMessage({ type: 'abort' });
      URL.revokeObjectURL(workerUrl);
      worker.terminate();
      abortController.abort();
    };

    return stream;
  };
};
