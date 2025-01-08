import { createEmission, createStream, internals, Stream } from '../abstractions';

export function from<T = any>(input: Iterable<T>): Stream<T> {
  // Create the stream with a custom run function
  const stream = createStream<T>('from', async function(this: Stream<T>) {
    const iterator = input[Symbol.iterator](); // Get the iterator for the input

    let done = false;

    // Helper function to process emissions sequentially
    const processNext = async () => {
      while (!done && !this[internals].shouldComplete()) {
        const result = iterator.next(); // Get the next value from the iterator

        const { value, done: isDone } = result;
        if (isDone) {
          done = true;
        } else {
          const emission = createEmission({ value });
          this.next(emission);

          // Wait for the emission to complete
          // if (emission.wait && typeof emission.wait === 'function') {
          //   await emission.wait(); // Await the emission's completion
          // }
        }
      }
    };

    // Start processing emissions
    processNext().then(() => {
      if (!this[internals].shouldComplete()) {
        this.complete(); // Complete the stream when done
      }
    }).catch((error) => {
      this.error(error); // Handle any errors
    });
  });

  return stream;
}
