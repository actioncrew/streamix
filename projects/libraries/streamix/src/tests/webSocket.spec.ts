import { eachValueFrom, webSocket } from "@actioncrew/streamix";
import { idescribe } from "./env.spec";

class MockWebSocket {
  static instances: MockWebSocket[] = [];
  readyState = 0;
  sent: string[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((ev: MessageEvent) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: ((ev: Event) => void) | null = null;

  constructor(public url: string) {
    MockWebSocket.instances.push(this);
    this.readyState = 0;
  }

  addEventListener(event: string, handler: any) {
    (this as any)[`on${event}`] = handler;
  }
  removeEventListener(event: string, _handler: any) {
    (this as any)[`on${event}`] = null;
  }
  send(data: string) {
    this.sent.push(data);
  }
  close() {
    this.readyState = 3;
    this.onclose?.();
  }
  // Helpers to simulate WebSocket events
  triggerOpen() {
    this.readyState = 1;
    this.onopen?.();
  }
  triggerMessage(data: any) {
    this.onmessage?.({ data: JSON.stringify(data) } as MessageEvent);
  }
  triggerClose() {
    this.readyState = 3;
    this.onclose?.();
  }
  triggerError() {
    this.onerror?.(new Event("error"));
  }
}

idescribe("webSocket", () => {
  let lastWs: MockWebSocket;
  let factory: jasmine.Spy;

  beforeEach(() => {
    factory = jasmine.createSpy("WebSocketFactory").and.callFake((url: string) => {
      lastWs = new MockWebSocket(url);
      return lastWs as any;
    });
  });

  it("should emit incoming messages", async () => {
    const stream = webSocket<any>("ws://test", factory);
    const iterator = eachValueFrom(stream);

    setTimeout(() => {
      lastWs.triggerMessage({ msg: 123 });
      lastWs.triggerClose();
    }, 1);

    const value = await iterator.next();
    expect(value.value).toEqual({ msg: 123 });
  });

  it("should send queued messages after open", async () => {
    const stream = webSocket<any>("ws://test", factory);

    stream.send({ cmd: "first" });
    stream.send({ cmd: "second" });

    lastWs.triggerOpen();

    expect(lastWs.sent.length).toBe(2);
    expect(lastWs.sent).toEqual([
      JSON.stringify({ cmd: "first" }),
      JSON.stringify({ cmd: "second" }),
    ]);
  });

  it("should propagate errors", async () => {
    const stream = webSocket<any>("ws://test", factory);
    const iterator = eachValueFrom(stream);

    setTimeout(() => lastWs.triggerError(), 1);

    try {
      await iterator.next();
      fail("Expected error to be thrown");
    } catch (err: any) {
      expect(err).toEqual(jasmine.any(Error));
      expect(err.message).toBe("WebSocket error");
    }
  });

  it("should close and cleanup on iterator return", async () => {
    const stream = webSocket<any>("ws://test", factory);
    const iterator = eachValueFrom(stream);

    lastWs.triggerOpen();
    spyOn(lastWs, "close").and.callThrough();

    await iterator.return?.(undefined);
    stream.close();
    expect(lastWs.close).toHaveBeenCalled();
  });
});
