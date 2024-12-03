import { Subscribable } from "rxjs";

export async function* eachValueFrom<T>(stream: Subscribable<T>): AsyncGenerator<T> {
  let isCompleted = false;

  // A separate promise to track the completion of the stream
  const completePromise = new Promise<void>((resolve) => {
    stream.subscribe({
      next: () => {},
      complete: () => {
        isCompleted = true; // Mark stream completion
        resolve(); // Resolve when the stream completes
      },
      error: (err: any) => {
        throw err; // Handle error if needed
      }
    });
  });

  while (!isCompleted) {
    // Use race to handle both emission and completion
    const value = await Promise.race([
      new Promise<T>((resolve, reject) => {
        const subscription = stream.subscribe({
          next: (value: T) => {
            resolve(value); // Resolve with the emitted value
          },
          error: (err: any) => {
            reject(err); // Reject on error
          }
        });
      }),
      completePromise // If the stream completes, this will trigger
    ]);

    // Yield the value once resolved
    if (value !== undefined) {
      yield value;
    }
  }
}
