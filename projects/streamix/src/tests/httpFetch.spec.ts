import { httpFetch } from "../lib"; // Adjust the import based on your project structure

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

  test("httpFetch should properly stream large files and update progress", (done) => {
    // Create a mock large file (10MB)
    const largeFile = new Uint8Array(10 * 1024 * 1024).fill(1); // 10MB

    let lastProgress = 0;
    const progressUpdates: number[] = [];

    const stream = httpFetch("http://localhost:3000/large-file", {}, (progress) => {
      lastProgress = progress;
      progressUpdates.push(progress);
    });

    const chunks: Uint8Array[] = [];
    const subscription = stream.subscribe({
      next : (value) => {
        chunks.push(value as Uint8Array);
      },
      complete: () => {
        subscription.unsubscribe();

        // Verify received data matches the mock file
        const receivedFile = new Uint8Array(chunks.reduce<number[]>((acc, val) => acc.concat([...val]), []));
        expect(receivedFile.length).toBe(largeFile.length);
        expect(receivedFile).toEqual(largeFile);

        // Ensure progress updates correctly
        expect(lastProgress).toBe(1);
        expect(progressUpdates.some(p => p > 0 && p < 1)).toBe(true);
        done();
      }
    });
  });
});
