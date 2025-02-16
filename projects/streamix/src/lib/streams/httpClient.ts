import { createEmission, createStream, Stream } from "../abstractions";
import { http, HttpStream } from "./http";
import { jsonp } from "./jsonp";

export interface HttpOptions {
  headers?: Record<string, string>;
  params?: Record<string, string>;
  responseType?: "json" | "text" | "blob" | "arraybuffer";
  reportProgress?: (progress: number) => void;
  withCredentials?: boolean;
  body?: any;
}

export type HttpClient = {
  get<T>(url: string, options?: HttpOptions): HttpStream<T>;
  post<T>(url: string, options?: HttpOptions): HttpStream<T>;
  put<T>(url: string, options?: HttpOptions): HttpStream<T>;
  patch<T>(url: string, options?: HttpOptions): HttpStream<T>;
  delete<T>(url: string, options?: HttpOptions): HttpStream<T>;
  jsonp<T>(url: string, callbackName?: string): Stream<T>;
};

export const createHttpClient = (baseUrl?: string): HttpClient => {
  const resolveUrl = (url: string, params?: Record<string, string>): string => {
    const fullUrl =
      url.startsWith("http://") || url.startsWith("https://") ? url : new URL(url, baseUrl).toString();

    if (params) {
      const urlObj = new URL(fullUrl);
      Object.entries(params).forEach(([key, value]) => urlObj.searchParams.append(key, value));
      return urlObj.toString();
    }

    return fullUrl;
  };

  const handleResponseType = <T>(stream: HttpStream<Response>, responseType?: HttpOptions["responseType"]): HttpStream<T> => {
    return createStream<T>("httpStream", async function* () {
      for await (const emission of stream) {
        const response = emission.value as Response;
        let parsedData: T;

        switch (responseType) {
          case "json":
            parsedData = (await response.json()) as T;
            break;
          case "text":
            parsedData = (await response.text()) as T;
            break;
          case "blob":
            parsedData = (await response.blob()) as T;
            break;
          case "arraybuffer":
            parsedData = (await response.arrayBuffer()) as T;
            break;
          default:
            parsedData = (await response.json()) as T; // Default to JSON
            break;
        }

        yield createEmission({ value: parsedData });
      }
    }) as HttpStream<T>;
  };

  return {
    get: <T>(url: string, options: HttpOptions = {}): HttpStream<T> =>
      handleResponseType<T>(
        http(
          resolveUrl(url, options.params),
          {
            method: "GET",
            headers: options.headers,
            credentials: options.withCredentials ? "include" : "same-origin",
          },
          options.reportProgress
        ),
        options.responseType
      ),

    post: <T>(url: string, options: HttpOptions = {}): HttpStream<T> =>
      handleResponseType<T>(
        http(
          resolveUrl(url, options.params),
          {
            method: "POST",
            headers: options.headers,
            credentials: options.withCredentials ? "include" : "same-origin",
            body: options.body ? JSON.stringify(options.body) : undefined,
          },
          options.reportProgress
        ),
        options.responseType
      ),

    put: <T>(url: string, options: HttpOptions = {}): HttpStream<T> =>
      handleResponseType<T>(
        http(
          resolveUrl(url, options.params),
          {
            method: "PUT",
            headers: options.headers,
            credentials: options.withCredentials ? "include" : "same-origin",
            body: options.body ? JSON.stringify(options.body) : undefined,
          },
          options.reportProgress
        ),
        options.responseType
      ),

    patch: <T>(url: string, options: HttpOptions = {}): HttpStream<T> =>
      handleResponseType<T>(
        http(
          resolveUrl(url, options.params),
          {
            method: "PATCH",
            headers: options.headers,
            credentials: options.withCredentials ? "include" : "same-origin",
            body: options.body ? JSON.stringify(options.body) : undefined,
          },
          options.reportProgress
        ),
        options.responseType
      ),

    delete: <T>(url: string, options: HttpOptions = {}): HttpStream<T> =>
      handleResponseType<T>(
        http(
          resolveUrl(url, options.params),
          {
            method: "DELETE",
            headers: options.headers,
            credentials: options.withCredentials ? "include" : "same-origin",
          },
          options.reportProgress
        ),
        options.responseType
      ),

    jsonp: <T>(url: string, callbackName: string = `jsonp_callback_${Date.now()}`): Stream<T> =>
      jsonp<T>(resolveUrl(url), callbackName),
  };
};
