import { fork, of, createStream, from, concatMap } from '../lib';  // Adjust the import path accordingly

describe('fork operator', () => {
  let source$: any;
  let options: Array<{ on: (value: number) => boolean; handler: any }>;

  beforeEach(() => {
    // Create mock streams using `createStream`
    options = [
      { on: (value: number) => value <= 5, handler: () => of('Small number') },
      { on: (value: number) => value > 5 && value <= 15, handler: () => of('Medium number') },
      { on: (value: number) => value > 15, handler: () => of('Large number') },
    ];

    // Initialize the source observable
    source$ = from([1, 5, 10, 20]); // Emissions: 1, 5, 10, 20
  });

  it('should handle multiple emissions and match the correct stream', (done) => {
    const result: string[] = [];

    source$.pipe(fork(options)).subscribe((value: any) => {
      result.push(value);
    });

    source$.onStop.once(() => {
      expect(result).toEqual(['Small number', 'Small number', 'Medium number', 'Large number']);
      done();
    });
  });

  it('should match the correct stream based on conditions', (done) => {
    const result: string[] = [];
    const source$ = from([1, 10, 20]); // Emissions: 1, 10, 20

    source$.pipe(fork(options)).subscribe((value: any) => result.push(value));
    source$.onStop.once(() => {
      // Test each value matches the correct case
      expect(result[0]).toBe('Small number');
      expect(result[1]).toBe('Medium number');
      expect(result[2]).toBe('Large number');
      done();
    });
  });

  it('should return an error if no case matches', (done) => {
    const result: string[] = [];
    const invalidOptions = [
      { on: (value: number) => value === 100, handler: () => of('Invalid number') },
    ];

    const source$ = from([1, 5, 10, 20]); // Emissions: 1, 5, 10, 20

    source$.pipe(fork(invalidOptions)).subscribe((value: any) => result.push(value));
    source$.onError.once(({ error }: any) => {
      expect(error).toBe('No handler found for value: 1');
      done();
    });
  });

  it('should handle a custom stream correctly for each case', (done) => {
    const result: string[] = [];
    const customStream = () => of('Custom stream result');

    options = [];
    // Adding a custom case to `options`
    options.push({
      on: (value: number) => value === 10,
      handler: customStream,
    });

    const source$ = of(10); // Single emission: 10

    source$.pipe(fork(options)).subscribe((value: any) => result.push(value));
    source$.onStop.once(() => {
      expect(result).toEqual(['Custom stream result']);
      done();
    });
  });
});