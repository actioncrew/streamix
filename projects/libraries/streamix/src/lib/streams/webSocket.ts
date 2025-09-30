import { createStream, Stream } from "../abstractions";

/**
 * A stream that represents a WebSocket-like interface.
 * Extends a standard Stream with a `.send()` method to send messages.
 *
 * @template T The type of messages sent and received.
 */
export type WebSocketStream<T = any> = Stream<T> & {
  /** Sends a JSON-serializable message to the WebSocket server. */
  send: (message: T) => void;
  /** Close the WebSocket and stop the generator */
  close: () => void;
};

/** Factory type for dependency injection of WebSocket (mockable in tests) */
export type WebSocketFactory = (url: string) => WebSocket;

/**
 * Creates a WebSocket stream for bidirectional communication with a server.
 *
 * Incoming messages from the WebSocket are emitted as stream values.
 * Outgoing messages are sent via the `.send()` method.
 * Messages sent before the connection is open are queued automatically.
 *
 * @template T - Type of messages to send and receive.
 * @param url The WebSocket URL.
 * @param factory Optional WebSocket factory for dependency injection (useful for testing).
 * @returns {WebSocketStream<T>} A WebSocketStream that can be used to
 * send and receive messages of type T.
 */
export function webSocket<T = any>(
  url: string,
  factory: WebSocketFactory = (u) => new WebSocket(u)
): WebSocketStream<T> {
  const messageQueue: T[] = [];
  const sendQueue: T[] = [];
  let resolveNext: ((value: T) => void) | null = null;
  let rejectNext: ((error: any) => void) | null = null;
  let isOpen = false;
  let done = false;

  // Create WebSocket immediately
  const socket = factory(url);

  // Event handlers
  const onOpen = () => {
    isOpen = true;
    while (sendQueue.length) socket.send(JSON.stringify(sendQueue.shift()!));
  };

  const onMessage = (ev: MessageEvent) => {
    try {
      const data = JSON.parse(ev.data);
      messageQueue.push(data);
      resolveNext?.(messageQueue.shift()!);
      resolveNext = rejectNext = null;
    } catch (err) {
      rejectNext?.(err);
      resolveNext = rejectNext = null;
    }
  };

  const onClose = () => {
    done = true;
    rejectNext?.(new Error("WebSocket closed"));
    resolveNext = rejectNext = null;
  };

  const onError = () => {
    done = true;
    rejectNext?.(new Error("WebSocket error"));
    resolveNext = rejectNext = null;
  };

  socket.addEventListener("open", onOpen);
  socket.addEventListener("message", onMessage);
  socket.addEventListener("close", onClose);
  socket.addEventListener("error", onError);

  async function* generator() {
    try {
      while (!done) {
        if (messageQueue.length) yield messageQueue.shift()!;
        else {
          yield await new Promise<T>((resolve, reject) => {
            resolveNext = resolve;
            rejectNext = reject;
          });
        }
      }
    } finally {
      socket.removeEventListener("open", onOpen);
      socket.removeEventListener("message", onMessage);
      socket.removeEventListener("close", onClose);
      socket.removeEventListener("error", onError);
      if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
        socket.close();
      }
    }
  };

  const stream = createStream<T>("webSocket", generator) as WebSocketStream<T>;

  // Send method
  stream.send = (msg: T) => {
    if (isOpen) socket.send(JSON.stringify(msg));
    else sendQueue.push(msg);
  };

  stream.close = () => {
    done = true;
    if (socket && socket.readyState === WebSocket.OPEN) socket.close();
    rejectNext?.(new Error("WebSocket closed"));
    resolveNext = rejectNext = null;
  };

  return stream;
}
