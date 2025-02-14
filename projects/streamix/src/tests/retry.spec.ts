import { createEmission, createStream, retry } from "../lib";

describe('retry stream', () => {
  it('should retry the stream once on error and emit correct values', async () => {
    let attempt = 0;
    const factory = jest.fn(() => {
      attempt++;
      return createStream<number>('testStream', async function* () {
        if (attempt === 1) {
          yield createEmission({ value: 1 });
          yield createEmission({ value: 2 });
          throw new Error('Test Error'); // Simulate error on first attempt
        } else {
          yield createEmission({ value: 3 });
          yield createEmission({ value: 4 }); // Success on second attempt
        }
      });
    });

    const result: number[] = [];
    const stream$ = retry(factory, 3, 1000);

    for await (const emission of stream$) {
      result.push(emission.value!);
    }

    expect(result).toEqual([3, 4]); // Values emitted after retrying
    expect(factory).toHaveBeenCalledTimes(2); // The stream was retried once
  });

  it('should not retry if stream completes successfully on first try', async () => {
    const factory = jest.fn(() => {
      return createStream<number>('testStream', async function* () {
        yield createEmission({ value: 1 });
        yield createEmission({ value: 2 }); // Success without error
      });
    });

    const result: number[] = [];
    const stream$ = retry(factory, 3, 1000);

    for await (const emission of stream$) {
      result.push(emission.value!);
    }

    expect(result).toEqual([1, 2]); // Values emitted immediately, no retry needed
    expect(factory).toHaveBeenCalledTimes(1); // The stream was not retried
  });

  it('should emit error after max retries are reached', async () => {
    const factory = jest.fn(() => {
      return createStream<number>('testStream', async function* () {
        throw new Error('Test Error'); // Always error out
      });
    });

    const result: any[] = [];
    const stream$ = retry(factory, 2, 500); // Retry 2 times, maxRetries = 2

    try {
      for await (const value of stream$) {
        result.push(value); // This should not be hit
      }
    } catch (error: any) {
      result.push(error.message); // Catch the error after retries
    }

    expect(result).toEqual(['Test Error']); // After max retries, error should be emitted
    expect(factory).toHaveBeenCalledTimes(3); // The stream should have been retried 2 times
  });

  it('should emit correct values after retrying stream multiple times', async () => {
    let attempt = 0;
    const factory = jest.fn(() => {
      attempt++;
      return createStream<number>('testStream', async function* () {
        if (attempt === 1) {
          yield createEmission({ value: 1 });
          yield createEmission({ value: 2 });
          throw new Error('Test Error'); // Simulate error on first attempt
        } else {
          yield createEmission({ value: 3 });
          yield createEmission({ value: 4 }); // Success on second attempt
        }
      });
    });

    const result: number[] = [];
    const stream$ = retry(factory, 3, 1000); // Retry up to 3 times

    for await (const emission of stream$) {
      result.push(emission.value!);
    }

    expect(result).toEqual([3, 4]); // Values emitted after retrying
    expect(factory).toHaveBeenCalledTimes(2); // The stream was retried once
  });
});
