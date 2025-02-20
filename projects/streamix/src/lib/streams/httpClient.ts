import { HttpFetch, httpInit, HttpStream } from "./fetch";

export interface HttpOptions {
  headers?: Record<string, string>;
  params?: Record<string, string>;
  reportProgress?: (progress: number) => void;
  withCredentials?: boolean;
  body?: any;
}

export type HttpClientConfig = {
  http?: HttpFetch;
  baseUrl?: string;
  defaultHeaders?: Record<string, string>;
};

export type HttpClient = {
  get<T = any>(url: string, options?: HttpOptions): HttpStream<T>;
  post<T = any>(url: string, options?: HttpOptions): HttpStream<T>;
  put<T = any>(url: string, options?: HttpOptions): HttpStream<T>;
  patch<T = any>(url: string, options?: HttpOptions): HttpStream<T>;
  delete<T = any>(url: string, options?: HttpOptions): HttpStream<T>;
};

export const createHttpClient = (config: HttpClientConfig = { http: httpInit(), defaultHeaders: {'Content-Type': 'application/json'} }): HttpClient => {
  const { baseUrl, defaultHeaders } = config;

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

  const mergeHeaders = (defaultHeaders: Headers, customHeaders: Headers): Headers => {
    const mergedHeaders = new Headers();

    defaultHeaders.forEach((value, key) => {
      mergedHeaders.append(key, value);
    });

    customHeaders.forEach((value, key) => {
      mergedHeaders.append(key, value);
    });

    return mergedHeaders;
  };

  const toHeaders = (headers: Record<string, string> | Headers): Headers => {
    return headers instanceof Headers ? headers : new Headers(headers);
  };

  const encodeUrlEncoded = (params: Record<string, any>): string => {
    const urlSearchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      urlSearchParams.append(key, String(value));
    });
    return urlSearchParams.toString();
  };

  const request = (method: string, url: string, options: HttpOptions = {}): HttpStream => {
    const headers = mergeHeaders(toHeaders(defaultHeaders!), toHeaders(options.headers || {}));

    let body: any = undefined;
    if (options.body instanceof FormData) {
      // For FormData, no need to set Content-Type, browser will do it
      body = options.body;
    } else if (options.body instanceof URLSearchParams) {
      // For x-www-form-urlencoded, we use URLSearchParams to encode the body
      if (!headers.has("Content-Type")) {
        headers.set("Content-Type", "application/x-www-form-urlencoded");
      }
      body = encodeUrlEncoded(options.body as Record<string, any>); // Convert URLSearchParams to string
    } else if (options.body) {
      // For JSON body, set Content-Type to application/json if not set
      if (!headers.has("Content-Type")) {
        headers.set("Content-Type", "application/json");
      }
      body = JSON.stringify(options.body); // Stringify the JSON body
    }

    return config.http!(
      resolveUrl(url, options.params),
      {
        method,
        headers,
        credentials: options.withCredentials ? "include" : "same-origin",
        body,
      },
      options.reportProgress
    );
  };

  return {
    get: <T>(url: string, options?: HttpOptions): HttpStream<T> => request("GET", url, options),
    post: <T>(url: string, options?: HttpOptions): HttpStream<T> => request("POST", url, options),
    put: <T>(url: string, options?: HttpOptions): HttpStream<T> => request("PUT", url, options),
    patch: <T>(url: string, options?: HttpOptions): HttpStream<T> => request("PATCH", url, options),
    delete: <T>(url: string, options?: HttpOptions): HttpStream<T> => request("DELETE", url, options),
  };
};
