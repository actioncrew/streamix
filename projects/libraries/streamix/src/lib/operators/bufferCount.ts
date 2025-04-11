import { Stream, StreamMapper } from '../abstractions'; // Import necessary types
import { createSubject, Subject } from '../streams';
import { createMapper } from './../abstractions/operator';

export const bufferCount = (bufferSize: number = Infinity): StreamMapper => {
  let buffer: any[] = [];

  const operator = (input: Stream<any>, output: Subject<any[]>) => {

    input.subscribe({
      next: (value) => {
        buffer.push(value);

        // Emit buffer when it reaches the specified size
        if (buffer.length >= bufferSize) {
          output.next(buffer);
          buffer = [];  // Clear the buffer
        }
      },
      error: (err) => output.error(err),
      complete: () => {
        if (buffer.length > 0) {
          output.next(buffer); // Emit remaining items when stream completes
        }
        output.complete();
      },
    });
  };

  return createMapper("bufferCount", createSubject<any[]>(), operator);
};
