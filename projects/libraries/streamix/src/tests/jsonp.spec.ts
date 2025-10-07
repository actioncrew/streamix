import { eachValueFrom, firstValueFrom, jsonp } from "@actioncrew/streamix";
import { idescribe } from "./env.spec";

idescribe("jsonp", () => {
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

  /**
   * Mocks JSONP <script> behavior without ever hitting the network
   */
  function setupJsonpMock(testData?: any, fail = false) {
    let appendedScript: HTMLScriptElement | null = null;
    let removedScript: HTMLScriptElement | null = null;
    let callbackName: string | null = null;

    document.head.appendChild = function <T extends Node>(node: T): T {
      if (node instanceof HTMLScriptElement) {
        appendedScript = node;
        const src = node.src;
        callbackName = decodeURIComponent(src.split("callback=")[1] || "");

        setTimeout(() => {
          if (fail) {
            node.onerror?.(new Event("error"));
          } else if (testData && callbackName) {
            (window as any)[callbackName!](testData);
            node.onload?.(new Event("load"));
          }
        }, 1);

        // Return node, don't call original appendChild
        return node;
      }
      return originalHeadAppend.call(this, node) as any;
    };

    document.head.removeChild = function <T extends Node>(node: T): T {
      if (node instanceof HTMLScriptElement) removedScript = node;
      return originalHeadRemove.call(this, node) as any;
    };

    return { appendedScript, removedScript, callbackName };
  }

  it("should emit data from JSONP call and cleanup", async () => {
    const testData = { foo: "bar" };
    const refs = setupJsonpMock(testData);

    const stream = jsonp<typeof testData>("https://example.com/data");
    const result = await firstValueFrom(stream);

    // Wait for simulated callback cleanup
    await new Promise(r => setTimeout(r, 2));

    expect(result).toEqual(testData);
    expect(refs.callbackName && (window as any)[refs.callbackName]).toBeFalsy();
    expect(refs.removedScript).toBe(refs.appendedScript);
  });

  it("should reject the promise if script fails to load", async () => {
    // Silence console errors for failing request
    const originalConsoleError = console.error;
    console.error = () => {};

    const refs = setupJsonpMock(undefined, true);

    const stream = jsonp("https://example.com/bad.jsonp");
    let caughtError: any = null;

    try {
      await firstValueFrom(stream);
    } catch (err) {
      caughtError = err;
    }

    console.error = originalConsoleError;

    expect(caughtError).toBeTruthy();
    expect(caughtError.message).toContain("JSONP request failed");
    expect(refs.removedScript).toBe(refs.appendedScript);
  });

  it("should cleanup even if iterator is closed early", async () => {
    const testData = { hello: "world" };
    const refs = setupJsonpMock(testData);

    const stream = jsonp<typeof testData>("https://example.com/data");
    const iterator = eachValueFrom(stream);

    const valuePromise = iterator.next();
    await iterator.return?.(undefined); // Early close

    const value = await valuePromise;

    // Wait for simulated cleanup
    await new Promise(r => setTimeout(r, 2));

    expect(value.value).toEqual(testData);
    expect(refs.removedScript).toBe(refs.appendedScript);

    // Ensure no lingering global callback
    const remainingCallbacks = Object.keys(window).filter(k => /^callback_/.test(k));
    expect(remainingCallbacks.length).toBe(0);
  });
});
