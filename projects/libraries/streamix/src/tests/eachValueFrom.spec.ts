import { createSubject, eachValueFrom, EMPTY, firstValueFrom, from, lastValueFrom } from '@actioncrew/streamix';

describe('eachValueFrom', () => {
  it('should get first value from the stream', async () => {
    const first = await firstValueFrom(from([1, 2, 3]));

    expect(first).toBe(1); // The first emitted value should be 1
  });

  it('should get last value from the stream', async () => {
    const last = await lastValueFrom(from([1, 2, 3]));

    expect(last).toBe(3); // The last emitted value should be 3
  });
  
  it('should throw an error if the source stream fails before completion for lastValueFrom', async () => {
    const source$ = createSubject<number>();
    const expectedError = new Error('Source failed unexpectedly');

    // We use try/catch to assert that the promise returned by lastValueFrom is rejected
    try {
      // Start the asynchronous operation
      const promise = lastValueFrom(source$);

      // Emit some values, which should be ignored since the stream errors
      source$.next(10);
      source$.next(20);

      // Cause the stream to fail
      source$.error(expectedError);

      // Wait for the promise to settle
      await promise;

      // If it reaches here, the test fails because it completed instead of errored
      fail('lastValueFrom should have thrown an error, but completed successfully.');
    } catch (error: any) {
      // Assert that the error caught is the expected one
      expect(error).toBe(expectedError);
    }
  });

  it('should get each value emitted from the stream', async () => {
    // Using eachValueFrom
    const emittedValues = [];
    for await (const value of eachValueFrom(from([1, 2, 3]))) {
      emittedValues.push(value);
    }

    expect(emittedValues).toEqual([1, 2, 3]); // Should collect all emitted values
  });

  it('should handle an empty stream', async () => {

    try {
      // Using firstValueFrom
      await firstValueFrom(EMPTY);
    } catch (error: any) {
      expect(error.message).toBe("Stream completed without emitting a value"); // No value should be emitted
    }

    try {
      // Using lastValueFrom
      await lastValueFrom(EMPTY);
    } catch (error: any) {
      expect(error.message).toBe("Stream completed without emitting a value"); // No value should be emitted
    }

    // Using eachValueFrom
    const emittedValues = [];
    for await (const value of eachValueFrom(EMPTY)) {
      emittedValues.push(value);
    }
    expect(emittedValues).toEqual([]); // No values should be emitted
  });
});