import { createStream, Stream } from '../abstractions';

export type WebSocketStream<T = any> = Stream<T> & {
  send: (message: T) => void;
};

/**
 * Creates a WebSocket stream for bidirectional communication.
 *
 * Incoming messages are emitted as stream values.
 * Outgoing messages are sent via the `.send()` method.
 */
export function webSocket<T = any>(url: string): WebSocketStream<T> {
  let socket: WebSocket | null = null;
  let isOpen = false;
  const sendQueue: T[] = [];
  let resolveNext: ((value: T | PromiseLike<T>) => void) | null = null;
  let rejectNext: ((error: any) => void) | null = null;

  const controller = new AbortController();
  const signal = controller.signal;

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
      if (signal.aborted) return;
      try {
        const data = JSON.parse(event.data);
        messageQueue.push(data);
        if (resolveNext) {
          resolveNext(messageQueue.shift()!);
          resolveNext = null;
        }
      } catch (err) {
        errorQueue.push(err);
        if (resolveNext) {
          resolveNext(Promise.reject(err));
          resolveNext = null;
        }
      }
    };

    const onClose = () => {
      done = true;
      if (resolveNext) {
        resolveNext(Promise.reject(new Error('WebSocket closed')));
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
      while (!done && !signal.aborted) {
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
    if (socket && isOpen && !signal.aborted) {
      socket.send(JSON.stringify(message));
    } else {
      sendQueue.push(message);
    }
  };

  return stream;
}
