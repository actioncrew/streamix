import { createStream, Stream } from '../abstractions';

/**
 * A stream that represents a WebSocket-like interface.
 * It extends a standard async {@link Stream} with a `send` method
 * to send messages into the stream.
 *
 * Incoming messages from the WebSocket are emitted as stream values.
 * Outgoing messages are sent via the `.send()` method.
 *
 * @template T - The type of messages to be sent and received.
 * @typedef {Stream<T> & { send: (message: T) => void }} WebSocketStream
 */
export type WebSocketStream<T = any> = Stream<T> & {
  /**
   * Sends a message to the WebSocket server.
   *
   * If the WebSocket connection is open, the message is sent immediately.
   * If the connection is not yet open, the message is queued and will be
   * sent automatically once the connection is established.
   *
   * The message will be serialized to a JSON string before being sent.
   *
   * @param {T} message - The message to be sent. Must be a JSON-serializable object.
   */
  send: (message: T) => void;
};

/**
 * Creates a WebSocket stream for bidirectional communication with a server.
 *
 * Incoming messages from the WebSocket are emitted as stream values.
 * Outgoing messages are sent via the `.send()` method on the returned stream.
 * The stream automatically handles message queuing if the connection is not yet open.
 *
 * The stream completes when the WebSocket connection closes.
 * Errors from the WebSocket are propagated to the stream.
 *
 * @template T - The type of messages to be sent and received. Assumes messages are JSON-serializable.
 * @param {string} url - The URL of the WebSocket server to connect to.
 * @returns {WebSocketStream<T>} A stream that emits messages from the WebSocket and has a `send` method to send messages to it.
 */
export function webSocket<T = any>(url: string): WebSocketStream<T> {
  let socket: WebSocket | null = null;
  let isOpen = false;
  const sendQueue: T[] = [];
  let resolveNext: ((value: T | PromiseLike<T>) => void) | null = null;
  let rejectNext: ((error: any) => void) | null = null;

  let done = false;

  // The async generator yields incoming messages
  async function* messageGenerator() {
    socket = new WebSocket(url);

    const messageQueue: T[] = [];
    const errorQueue: any[] = [];

    const onOpen = () => {
      isOpen = true;
      // Flush any queued sends
      while (sendQueue.length > 0) {
        const msg = sendQueue.shift()!;
        socket!.send(JSON.stringify(msg));
      }
    };

    const onMessage = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        messageQueue.push(data);
        if (resolveNext) {
          resolveNext(messageQueue.shift()!);
          resolveNext = null;
          rejectNext = null;
        }
      } catch (err) {
        errorQueue.push(err);
        if (rejectNext) {
          rejectNext(err);
          rejectNext = null;
          resolveNext = null;
        }
      }
    };

    const onClose = () => {
      done = true;
      if (rejectNext) {
        rejectNext(new Error('WebSocket closed'));
        rejectNext = null;
        resolveNext = null;
      }
    };

    const onError = () => {
      done = true;
      const err = new Error('WebSocket error');
      if (rejectNext) {
        rejectNext(err);
        rejectNext = null;
        resolveNext = null;
      }
    };

    socket.addEventListener('open', onOpen);
    socket.addEventListener('message', onMessage);
    socket.addEventListener('close', onClose);
    socket.addEventListener('error', onError);

    try {
      while (!done) {
        if (errorQueue.length > 0) {
          throw errorQueue.shift();
        }
        if (messageQueue.length > 0) {
          yield messageQueue.shift()!;
        } else {
          // Wait for next message or error
          const nextValue = await new Promise<T>((resolve, reject) => {
            resolveNext = resolve;
            rejectNext = reject;
          });
          yield nextValue;
        }
      }
    } finally {
      if (socket) {
        socket.removeEventListener('open', onOpen);
        socket.removeEventListener('message', onMessage);
        socket.removeEventListener('close', onClose);
        socket.removeEventListener('error', onError);
        if (socket.readyState === WebSocket.OPEN) {
          socket.close();
        }
        socket = null;
      }
    }
  }

  // Create the stream wrapping the generator
  let stream = createStream<T>('webSocket', messageGenerator) as WebSocketStream<T>;

  // Attach send method
  stream.send = (message: T) => {
    if (socket && isOpen) {
      socket.send(JSON.stringify(message));
    } else {
      sendQueue.push(message);
    }
  };

  return stream;
}
