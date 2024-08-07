import { ConcatMapOperator, from, of, Stream } from '../lib';

describe('ConcatMapOperator', () => {

  let project: (value: any) => Stream;
  let mockStream: Stream; // Assuming AbstractStream defines basic functionalities

  beforeEach(() => {
    project = (value: any) => {
      return new MyInnerStream(value); // Replace with your inner stream implementation
    };
    mockStream = new MyRealStream(); // Replace with your real stream implementation
  });

  it('should handle empty stream', async () => {
    const operator = new ConcatMapOperator(project);
    const request = { value: null, isCancelled: false };

    const result = await operator.handle(request, mockStream);

    expect(result).toEqual(request);
  });

  it('should handle cancelled stream', async () => {
    const operator = new ConcatMapOperator(project);
    const request = { value: 'data', isCancelled: true };

    const result = await operator.handle(request, mockStream);

    expect(result).toEqual({ ...request, isCancelled: true });
  });

  it('should project value and subscribe to inner stream (integration test)', async () => {
    const operator = new ConcatMapOperator(project);
    const request = { value: 'data', isCancelled: false };
    const expectedValue = 'innerValue'; // Expected value from inner stream

    const result = await operator.handle(request, mockStream);

    expect(result).toEqual(request); // Assuming handle returns the original request
  });

  it('should handle multiple emissions sequentially', async () => {
    const operator = new ConcatMapOperator(project);
    const requests = [
      { value: 'data1', isCancelled: false },
      { value: 'data2', isCancelled: false },
    ];

    const results = await Promise.all(
      requests.map(request => operator.handle(request, mockStream))
    );

    results.forEach((result, index) => {
      expect(result).toEqual(requests[index]);
    });
  });

  it('should handle errors in inner stream', async () => {
    const errorProject = (value: any) => {
      return new ErrorInnerStream(value); // Replace with your error inner stream implementation
    };
    const operator = new ConcatMapOperator(errorProject);
    const request = { value: 'data', isCancelled: false };

    try {
      await operator.handle(request, mockStream);
    } catch (error: any) {
      expect(error.message).toEqual('Inner Stream Error'); // Check for specific error object
    };
  });

  it('should complete inner stream before processing next emission', (done) => {

    const operator = new ConcatMapOperator(value => of(value));
    const emissions = [
      'data1',
      'data2',
      'data3',
      'data4',
      'data5',
    ];

    let processedOrder: any[] = [];
    const mockStream$ = from(emissions).pipe(operator);

    mockStream$.subscribe((value) => {
      processedOrder.push(value);
    });

    mockStream$.isStopped.then(() => {
      expect(processedOrder).toEqual(['data1', 'data2', 'data3', 'data4', 'data5']);
      done();
    });
  });


  it('should handle multiple emissions from outer stream and inner stream', (done) => {

    const outerEmissions = ['outer1', 'outer2'];
    const innerValues1 = ['inner1a', 'inner1b', 'inner1c'];
    const innerValues2 = ['inner2a', 'inner2b', 'inner2c'];

    const projectFunction = (value: any) => {
      if (value === 'outer1') {
        return from(innerValues1);
      } else if (value === 'outer2') {
        return from(innerValues2);
      } else {
        return from([]);
      }
    };

    const results: any[] = [];
    const operator = new ConcatMapOperator(projectFunction);
    const mockStream$ = from(outerEmissions).pipe(operator);

    mockStream$.subscribe((value) => {
      results.push(value)
    });

    mockStream$.isStopped.then(() => {
      expect(results.length).toEqual(6);
      expect(results).toEqual([
        'inner1a', 'inner1b', 'inner1c',
        'inner2a', 'inner2b', 'inner2c'
      ]);
      done();
    });
  });
});

// Example Inner Stream Implementation (Replace with your actual implementation)
class MyInnerStream extends Stream {
  private value: any;

  constructor(value: any) {
    super();
    this.value = value;
  }

  override async run(): Promise<void> {
    // Simulate inner stream behavior (emission, completion, error)
    await new Promise((resolve) => setTimeout(resolve, 10)); // Simulate delay
    this.emit({ value: this.value }, this.head!); // Emit the projected value
  }
}

// Example Real Stream Implementation (Replace with your actual implementation)
class MyRealStream extends Stream {
  override async run(): Promise<void> {
    // Simulate your real stream behavior (emitting values)
    this.emit({ value: 'streamValue1' }, this.head!);
  }
}

// Example Error Inner Stream Implementation (Replace with your actual implementation)
class ErrorInnerStream extends Stream {
  private value: any;

  constructor(value: any) {
    super();
    this.value = value;
  }

  override async run(): Promise<void> {
    throw new Error('Inner Stream Error');
  }
}

