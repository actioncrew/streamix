import "whatwg-fetch";
import { httpFetch } from "../lib"; // Adjust the import based on your project structure

import { TextDecoder, TextEncoder } from "util";

declare global {
  var TextEncoder: typeof TextEncoder;
  var TextDecoder: typeof TextDecoder;
}

global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder as any;

describe("httpFetch functional tests", () => {
  const API_URL = "https://jsonplaceholder.typicode.com/posts/1";

  test("should fetch data successfully", (done) => {
    const stream = httpFetch(API_URL);

    const subscription = stream.subscribe((value) => {
      subscription.unsubscribe();

      expect(value.length).toBeGreaterThan(0);
      expect(JSON.parse(value).id).toBe(1);
      done();
    });
  });

  test("should apply request interceptors", async () => {
    const stream = httpFetch(API_URL);

    httpFetch.addRequestInterceptor((req) => {
      expect(req.url).toBe(API_URL);
      return req;
    });

    const subscription = stream.subscribe();
    await new Promise((resolve) => setTimeout(resolve, 1000));
    subscription.unsubscribe();
  });

  test("should apply response interceptors", async () => {
    const stream = httpFetch(API_URL);

    httpFetch.addResponseInterceptor(async (res) => {
      expect(res.ok).toBe(true);
      return res;
    });

    const subscription = stream.subscribe();
    await new Promise((resolve) => setTimeout(resolve, 1000));
    subscription.unsubscribe();
  });

  test("should handle abort correctly", async () => {
    const stream = httpFetch(API_URL);
    const subscription = stream.subscribe();

    setTimeout(() => {
      subscription.unsubscribe();
    }, 100);

    await new Promise((resolve) => setTimeout(resolve, 500));
    expect(stream.abort).toBeDefined();
  });

  test("should handle network error", async () => {
    const stream = httpFetch("https://invalid.url");
    const errors: any[] = [];

    const subscription = stream.subscribe({
      error: (err) => {
        errors.push(err);
      },
    });

    await new Promise((resolve) => setTimeout(resolve, 1000));
    subscription.unsubscribe();

    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]).toBeInstanceOf(Error);
  });

  xtest("should fetch data with progress notification successfully", (done) => {
    const proxyUrl = 'https://cors-anywhere.herokuapp.com/';
    const targetUrl = 'https://nbg1-speed.hetzner.com/100MB.bin';
    const stream = httpFetch(proxyUrl + targetUrl,  {
      method: 'GET',
      headers: {
        'Origin': window.location.origin,  // Add Origin header
        'X-Requested-With': 'XMLHttpRequest',  // Optional but often required
        'Accept': 'application/json',
      }
    }, (value) => console.log(value));

    const subscription = stream.subscribe(value => {
      subscription.unsubscribe();
      expect(value.length).toBeGreaterThan(0);
      done();
    });
  });
});
