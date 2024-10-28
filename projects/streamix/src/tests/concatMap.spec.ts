import { concatMap, createStream, from, of, Stream } from '../lib';

describe('ConcatMapOperator', () => {

  let project: (value: any) => Stream;
  let mockStream: Stream; // Assuming AbstractStream defines basic functionalities

  beforeEach(() => {
    project = (value: any) => {
      return myInnerStream(value); // Replace with your inner stream implementation
    };
    mockStream = myRealStream(); // Replace with your real stream implementation
  });

  it('should handle empty stream', async () => {
    const operator = concatMap(project);
    operator.init(mockStream);

    const request = { value: null, isPhantom: false };

    const result = await operator.handle(request, mockStream);

    expect(result).toEqual(request);
  });

  it('should handle cancelled stream', async () => {
    const operator = concatMap(project);
    operator.init(mockStream);

    const request = { value: 'data', isPhantom: true };
    const result = await operator.handle(request, mockStream);

    expect(result).toEqual({ ...request, isPhantom: true });
  });

  it('should project value and subscribe to inner stream (integration test)', async () => {
    const operator = concatMap(project);
    operator.init(mockStream);

    const request = { value: 'data', isPhantom: false };
    const expectedValue = 'innerValue'; // Expected value from inner stream
    const result = await operator.handle(request, mockStream);

    expect(result).toEqual(request); // Assuming handle returns the original request
  });

  it('should handle multiple emissions sequentially', async () => {
    const operator = concatMap(project);
    operator.init(mockStream);

    const requests = [
      { value: 'data1', isPhantom: false },
      { value: 'data2', isPhantom: false },
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
      return errorInnerStream(value); // Replace with your error inner stream implementation
    };
    const operator = concatMap(errorProject);
    operator.init(mockStream);

    const request = { value: 'data', isPhantom: false };

    try {
      await operator.handle(request, mockStream);
    } catch (error: any) {
      expect(error.message).toEqual('Inner Stream Error'); // Check for specific error object
    };
  });

  it('should complete inner stream before processing next emission', (done) => {
    const emissions = [
      'data1',
      'data2',
      'data3',
      'data4',
      'data5',
    ];

    let processedOrder: any[] = [];
    const mockStream$ = from(emissions).pipe(concatMap(value => of(value)));

    mockStream$.subscribe((value: any) => {
      processedOrder.push(value);
    });

    mockStream$.onStop.once(() => {
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

    const operator = concatMap(projectFunction);
    operator.init(mockStream);

    const mockStream$ = from(outerEmissions).pipe(operator);

    mockStream$.subscribe((value: any) => {
      results.push(value)
    });

    mockStream$.onStop.once(() => {
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
export function myInnerStream(value: any): Stream {
  // Create the custom run function for MyInnerStream
  const run = async (stream: Stream): Promise<void> => {
    // Simulate inner stream behavior (emission, completion, error)
    await new Promise((resolve) => setTimeout(resolve, 10)); // Simulate delay
    await stream.onEmission.parallel({ emission: { value }, source: stream }); // Emit the projected value
  };

  // Create the stream using createStream and the custom run function
  return createStream(run);
}

// Example Real Stream Implementation (Replace with your actual implementation)
export function myRealStream(): Stream {
  // Create the custom run function for MyRealStream
  const run = async (stream: Stream): Promise<void> => {
    // Simulate your real stream behavior (emitting values)
    await stream.onEmission.parallel({ emission: { value: 'streamValue1' }, source: stream });
  };

  // Create the stream using createStream and the custom run function
  return createStream(run);
}


// Example Error Inner Stream Implementation (Replace with your actual implementation)
export function errorInnerStream(value: any): Stream {
  // Create the custom run function for ErrorInnerStream
  const run = async (stream: Stream): Promise<void> => {
    throw new Error('Inner Stream Error');
  };

  // Create the stream using createStream and the custom run function
  return createStream(run);
}
