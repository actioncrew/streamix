import { createEmission, Stream } from "../abstractions";
import { createSubject } from '../streams';

export interface WebSocketStream<T = any> extends Stream<T> {
  send: (message: T) => void;
}

/**
 * Creates a WebSocket-based Stream that allows bidirectional communication.
 *
 * @param url - The WebSocket URL to connect to.
 * @returns A WebSocketStream with message emission and sending capabilities.
 */
export function webSocketStream<T = any>(url: string): WebSocketStream<T> {
  const output = createSubject<T>(); // Use subject to emit messages to subscribers
  let socket: WebSocket | null = new WebSocket(url);
  const queue: T[] = [];
  let isOpen = false;

  const sendMessage = (message: T) => {
    if (socket && isOpen) {
      socket.send(JSON.stringify(message));
    } else {
      queue.push(message); // Queue messages until connection opens
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
      output.next(data); // Emit message via subject
    } catch (error) {
      console.error("Failed to parse WebSocket message:", error);
    }
  };

  const handleClose = () => {
    isOpen = false;
    output.complete();
    console.warn("WebSocket closed.");
  };

  socket.addEventListener("open", handleOpen);
  socket.addEventListener("message", handleMessage);
  socket.addEventListener("close", handleClose);

  return Object.assign(output, { send: sendMessage }) as WebSocketStream<T>;
}
