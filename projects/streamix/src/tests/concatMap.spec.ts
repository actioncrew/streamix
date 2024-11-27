import { createEmission, eventBus } from '../lib';
import { concatMap, createStream, from, of, Stream } from '../lib';

describe('ConcatMapOperator', () => {

  let project: (value: any) => Stream;

  beforeEach(() => {
    project = (value: any) => myInnerStream(value); // Replace with your inner stream implementation
  });

  it('should handle an empty stream', (done) => {
    const mockStream$ = from([]).pipe(concatMap(project));

    const emittedValues: any[] = [];
    mockStream$.subscribe({
      next: value => emittedValues.push(value),
      complete: () => {
        expect(emittedValues).toEqual([]);
        done();
      }
    });
  });

  it('should project values and subscribe to inner stream in sequence', (done) => {
    const mockStream$ = from(['1', '2', '3', '4', '5']).pipe(concatMap(project));
    const emittedValues: any[] = [];

    mockStream$.subscribe({
      next: value => emittedValues.push(value),
      complete: () => {
        expect(emittedValues).toEqual(['innerValue1', 'innerValue2', 'innerValue3', 'innerValue4', 'innerValue5']); // Expect each value from inner streams in sequence
        done();
      }
    });
  });

  it('should complete inner stream before processing next outer emission', (done) => {
    const emissions = ['1', '2', '3'];
    const mockStream$ = from(emissions).pipe(concatMap(value => of(value)));

    const emittedValues: any[] = [];
    mockStream$.subscribe({
      next: value => emittedValues.push(value),
      complete: () => {
        expect(emittedValues).toEqual(emissions); // Sequential handling expected
        done();
      }
    });
  });

  it('should handle errors in inner stream without affecting other emissions', (done) => {
    const errorProject = (value: any) => errorInnerStream(value);
    const values = ['1', '2'];
    const mockStream$ = from(values).pipe(concatMap(value => (value === '2' ? errorInnerStream(value) : project(value))));

    const emittedValues: any[] = [];
    const errors: any[] = [];

    mockStream$.subscribe({
      next: (value) => emittedValues.push(value),
      error: (error) => errors.push(error),
      complete: () => {
        expect(emittedValues).toEqual(['innerValue1']);
        expect(errors[0].message).toEqual('Inner Stream Error'); // Only second emission should throw
        done();
      }
    });
  });

  it('should correctly concatenate emissions from both outer and inner streams', (done) => {
    const outerValues = ['outer1', 'outer2'];
    const innerValues1 = ['inner1a', 'inner1b'];
    const innerValues2 = ['inner2a', 'inner2b'];

    const projectFn = (value: any) => {
      return value === 'outer1' ? from(innerValues1) : from(innerValues2);
    };

    const mockStream$ = from(outerValues).pipe(concatMap(projectFn));
    const emittedValues: any[] = [];

    mockStream$.subscribe({
      next: value => emittedValues.push(value),
      complete: () => {
        expect(emittedValues).toEqual(['inner1a', 'inner1b', 'inner2a', 'inner2b']);
        done();
      }
    });
  });
});

// Inner Stream Implementations (Replace with your actual implementations)
export function myInnerStream(value: any): Stream {
  return createStream(async function (this: Stream) {
    await new Promise((resolve) => setTimeout(resolve, 10)); // Simulated delay
    eventBus.enqueue({ target: this, payload: { emission: createEmission({ value: 'innerValue' + value }), source: this }, type: 'emission' });
  });
}

export function myRealStream(): Stream {
  return createStream(async function (this: Stream) {
    eventBus.enqueue({ target: this, payload: { emission: createEmission({ value: 'streamValue1' }), source: this }, type: 'emission' });
  });
}

export function errorInnerStream(value: any): Stream {
  return createStream(async function (this: Stream) {
    throw new Error('Inner Stream Error');
  });
}
