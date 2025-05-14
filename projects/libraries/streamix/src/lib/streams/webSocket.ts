import { Stream } from "../abstractions";
import { createSubject } from '../streams';

export type WebSocketStream<T = any> = Stream<T> & {
  send: (message: T) => void;
}

/**
 * Creates a WebSocket-based Stream that allows bidirectional communication.
 *
 * @param url - The WebSocket URL to connect to.
 * @returns A WebSocketStream with message emission and sending capabilities.
 */
export function webSocket<T = any>(url: string): WebSocketStream<T> {
  const output = createSubject<T>();
  let socket: WebSocket | null = new WebSocket(url);
  const queue: T[] = [];
  let isOpen = false;

  const sendMessage = (message: T) => {
    if (socket && isOpen) {
      socket.send(JSON.stringify(message));
    } else {
      queue.push(message);
    }
  };

  const handleOpen = () => {
    isOpen = true;
    while (queue.length > 0) {
      socket?.send(JSON.stringify(queue.shift()));
    }
  };

  const handleMessage = (event: MessageEvent) => {
    try {
      const data = JSON.parse(event.data);
      output.next(data);
    } catch (error) {
      console.error("Failed to parse WebSocket message:", error);
    }
  };

  const handleClose = () => {
    isOpen = false;
    if (!output.completed()) {
      output.complete(); // Only call complete if not already done
    }
    console.warn("WebSocket closed.");
  };

  const cleanup = () => {
    if (socket) {
      socket.removeEventListener("open", handleOpen);
      socket.removeEventListener("message", handleMessage);
      socket.removeEventListener("close", handleClose);
      socket.close();
      socket = null;
    }
  };

  // Wrap original complete/error to include cleanup
  const originalComplete = output.complete;
  output.complete = () => {
    originalComplete.call(output);
    cleanup();
  };

  const originalError = output.error;
  output.error = (err) => {
    originalError.call(output, err);
    cleanup();
  };

  socket.addEventListener("open", handleOpen);
  socket.addEventListener("message", handleMessage);
  socket.addEventListener("close", handleClose);

  return Object.assign(output, {
    name: "webSocket",
    send: sendMessage
  }) as WebSocketStream<T>;
}
