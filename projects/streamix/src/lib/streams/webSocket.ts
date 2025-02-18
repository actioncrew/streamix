import { createStream, Stream, createEmission } from "../abstractions";

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
  let socket: WebSocket | null = new WebSocket(url);
  const queue: T[] = [];
  let isOpen = false;

  const stream = createStream<T>("webSocketStream", async function* (this: Stream<T>) {
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
      if (!this.completed()) {
        try {
          const data = JSON.parse(event.data);
          this.emit(createEmission({ value: data }));
        } catch (error) {
          console.error("Failed to parse WebSocket message:", error);
        }
      }
    };

    const handleClose = () => {
      isOpen = false;
      if (!this.completed()) {
        console.warn("WebSocket closed.");
      }
    };

    socket.addEventListener("open", handleOpen);
    socket.addEventListener("message", handleMessage);
    socket.addEventListener("close", handleClose);

    try {
      while (!this.completed()) {
        await new Promise((resolve) => setTimeout(resolve, 1000)); // Keep the stream alive
      }
    } finally {
      socket.removeEventListener("open", handleOpen);
      socket.removeEventListener("message", handleMessage);
      socket.removeEventListener("close", handleClose);
      socket.close();
    }
  });

  return Object.assign(stream, {
    send: (message: T) => {
      if (socket && isOpen) {
        socket.send(JSON.stringify(message));
      } else {
        queue.push(message);
      }
    }
  }) as WebSocketStream<T>;
}
  
