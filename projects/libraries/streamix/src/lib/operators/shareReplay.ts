import { createOperator, createReplayBuffer } from "../abstractions";

export function shareReplay<T>(bufferSize = Infinity) {
  return createOperator<T>("shareReplay", (source) => {
    const buffer = createReplayBuffer<T>(bufferSize);
    let connected = false;

    // Start reading source into buffer, only once
    async function connect() {
      if (connected) return;
      connected = true;

      try {
        while (true) {
          const { value, done } = await source.next();
          if (done) break;
          await buffer.write(value);
        }
      } catch (err: any) {
        await buffer.error(err);
      } finally {
        await buffer.complete();
      }
    }

    let readerIdPromise: Promise<number> | null = null;
    let readerId: number | null = null;
    let done = false;

    connect();

    return {
      async next() {
        if (done) return { done: true, value: undefined };

        if (!readerIdPromise) {
          readerIdPromise = buffer.attachReader();
        }
        if (readerId === null) {
          readerId = await readerIdPromise;
        }

        try {
          const result = await buffer.read(readerId);
          if (result.done) {
            done = true;
          }
          return result;
        } catch (err) {
          done = true;
          throw err;
        }
      },
      async return() {
        if (readerId !== null) {
          await buffer.detachReader(readerId);
        }
        done = true;
        return { done: true, value: undefined };
      },
      async throw(err: any) {
        if (readerId !== null) {
          await buffer.detachReader(readerId);
        }
        done = true;
        throw err;
      }
    };
  });
}
