import { eachValueFrom, firstValueFrom, jsonp } from "@actioncrew/streamix";
import { idescribe } from "./env-spec";

idescribe("jsonp operator", () => {
  let originalHeadAppend: typeof document.head.appendChild;
  let originalHeadRemove: typeof document.head.removeChild;

  beforeAll(() => {
    originalHeadAppend = document.head.appendChild;
    originalHeadRemove = document.head.removeChild;
  });

  afterAll(() => {
    document.head.appendChild = originalHeadAppend;
    document.head.removeChild = originalHeadRemove;
  });

  it("should emit data from JSONP call and cleanup", async () => {
    const testData = { foo: "bar" };
    let appendedScript: HTMLScriptElement | null = null;
    let callbackName: string | null = null;

    // Override appendChild
    document.head.appendChild = function <T extends Node>(node: T): T {
      const result = originalHeadAppend.call(this, node) as T;
      if (node instanceof HTMLScriptElement) {
        appendedScript = node;
        const src = node.src;
        callbackName = decodeURIComponent(src.split("callback=")[1]);
        setTimeout(() => {
          (window as any)[callbackName!](testData);
        }, 1);
      }
      return result;
    };

    // Override removeChild
    let removedScript: HTMLScriptElement | null = null;
    document.head.removeChild = function <T extends Node>(node: T): T {
      if (node instanceof HTMLScriptElement) removedScript = node;
      return originalHeadRemove.call(this, node) as T;
    };

    const stream = jsonp<typeof testData>("https://example.com/data");
    const result = await firstValueFrom(stream);

    // Wait for callback cleanup
    await new Promise(r => setTimeout(r, 2));

    expect(result).toEqual(testData);
    expect(callbackName && (window as any)[callbackName]).toBeUndefined();
    expect(removedScript).toBe(appendedScript);
  });

  it("should reject the promise if script fails to load", async () => {
    // Simulate script loading failure
    document.head.appendChild = function <T extends Node>(node: T): T {
      const result = originalHeadAppend.call(this, node) as T;
      if (node instanceof HTMLScriptElement) {
        setTimeout(() => node.onerror?.(new Event("error")), 1);
      }
      return result;
    };

    const stream = jsonp("https://example.com/bad.jsonp");
    let caughtError: any = null;

    try {
      await firstValueFrom(stream);
    } catch (err) {
      caughtError = err;
    }

    expect(caughtError).toBeTruthy();
    expect(caughtError.message).toContain("JSONP request failed");
  });

  it("should cleanup even if iterator is closed early", async () => {
    const testData = { hello: "world" };
    let appendedScript: HTMLScriptElement | null = null;
    let removedScript: HTMLScriptElement | null = null;
    let callbackName: string | null = null;

    document.head.appendChild = function <T extends Node>(node: T): T {
      const result = originalHeadAppend.call(this, node) as T;
      if (node instanceof HTMLScriptElement) {
        appendedScript = node;
        const src = node.src;
        callbackName = decodeURIComponent(src.split("callback=")[1]);
        setTimeout(() => {
          (window as any)[callbackName!](testData);
        }, 1);
      }
      return result;
    };

    document.head.removeChild = function <T extends Node>(node: T): T {
      if (node instanceof HTMLScriptElement) removedScript = node;
      return originalHeadRemove.call(this, node) as T;
    };

    const stream = jsonp<typeof testData>("https://example.com/data");
    const iterator = eachValueFrom(stream);

    const valuePromise = iterator.next();
    await iterator.return?.(undefined); // Abandon iterator

    const value = await valuePromise;

    // Wait for cleanup
    await new Promise(r => setTimeout(r, 2));

    expect(value.value).toEqual(testData);
    expect(removedScript).toBe(appendedScript);

    // Ensure no lingering global callback
    const remainingCallbacks = Object.keys(window).filter(k => /^callback_/.test(k));
    expect(remainingCallbacks.length).toBe(0);
  });
});
