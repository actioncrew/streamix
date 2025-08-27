import { eachValueFrom, EMPTY, firstValueFrom, from, lastValueFrom } from '@actioncrew/streamix';

describe('eachValueFrom', () => {
  it('should get first value from the stream', async () => {
    const first = await firstValueFrom(from([1, 2, 3]));

    expect(first).toBe(1);  // The first emitted value should be 1
  });

  it('should get last value from the stream', async () => {
    const last = await lastValueFrom(from([1, 2, 3]));

    expect(last).toBe(3);  // The last emitted value should be 3
  });

  it('should get each value emitted from the stream', async () => {
    // Using eachValueFrom
    const emittedValues = [];
    for await (const value of eachValueFrom(from([1, 2, 3]))) {
      emittedValues.push(value);
    }

    expect(emittedValues).toEqual([1, 2, 3]);  // Should collect all emitted values
  });

  it('should handle an empty stream', async () => {

    try {
      // Using firstValueFrom
      await firstValueFrom(EMPTY);
    } catch (error: any) {
      expect(error.message).toBe("Stream completed without emitting a value");  // No value should be emitted
    }

    try {
      // Using firstValueFrom
      await lastValueFrom(EMPTY);
    } catch (error: any) {
      expect(error.message).toBe("Stream completed without emitting a value");  // No value should be emitted
    }

    // Using eachValueFrom
    const emittedValues = [];
    for await (const value of eachValueFrom(EMPTY)) {
      emittedValues.push(value);
    }
    expect(emittedValues).toEqual([]);  // No values should be emitted
  });
});
