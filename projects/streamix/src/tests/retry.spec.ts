import { createEmission, createStream, retry } from "../lib";

describe('retry stream', () => {
  it('should retry the stream once on error and emit correct values', async () => {
    let attempt = 0;
    const factory = jasmine.createSpy('factory').and.callFake(() => {
      attempt++;
      return createStream<number>('testStream', async function* () {
        if (attempt === 1) {
          yield createEmission({ value: 1 });
          yield createEmission({ value: 2 });
          throw new Error('Test Error');
        } else {
          yield createEmission({ value: 3 });
          yield createEmission({ value: 4 });
        }
      });
    });

    const result: number[] = [];
    const stream$ = retry(factory, 3, 1000);

    for await (const emission of stream$) {
      result.push(emission.value!);
    }

    expect(result).toEqual([3, 4]);
    expect(factory).toHaveBeenCalledTimes(2);
  });

  it('should not retry if stream completes successfully on first try', async () => {
    const factory = jasmine.createSpy('factory').and.callFake(() => {
      return createStream<number>('testStream', async function* () {
        yield createEmission({ value: 1 });
        yield createEmission({ value: 2 });
      });
    });

    const result: number[] = [];
    const stream$ = retry(factory, 3, 1000);

    for await (const emission of stream$) {
      result.push(emission.value!);
    }

    expect(result).toEqual([1, 2]);
    expect(factory).toHaveBeenCalledTimes(1);
  });

  it('should emit error after max retries are reached', async () => {
    const factory = jasmine.createSpy('factory').and.callFake(() => {
      return createStream<number>('testStream', async function* () {
        throw new Error('Test Error');
      });
    });

    const result: any[] = [];
    const stream$ = retry(factory, 2, 500);

    try {
      for await (const value of stream$) {
        result.push(value);
      }
    } catch (error: any) {
      result.push(error.message);
    }

    expect(result).toEqual(['Test Error']);
    expect(factory).toHaveBeenCalledTimes(3);
  });

  it('should emit correct values after retrying stream multiple times', async () => {
    let attempt = 0;
    const factory = jasmine.createSpy('factory').and.callFake(() => {
      attempt++;
      return createStream<number>('testStream', async function* () {
        if (attempt === 1) {
          yield createEmission({ value: 1 });
          yield createEmission({ value: 2 });
          throw new Error('Test Error');
        } else {
          yield createEmission({ value: 3 });
          yield createEmission({ value: 4 });
        }
      });
    });

    const result: number[] = [];
    const stream$ = retry(factory, 3, 1000);

    for await (const emission of stream$) {
      result.push(emission.value!);
    }

    expect(result).toEqual([3, 4]);
    expect(factory).toHaveBeenCalledTimes(2);
  });
});
