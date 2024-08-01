import { AbstractStream, ConcatMapOperator, Emission } from '../lib';

describe('ConcatMapOperator', () => {
  let project: (value: any) => AbstractStream;
  let mockStream: AbstractStream; // Assuming AbstractStream defines basic functionalities

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

  it('should complete inner stream before processing next emission', async () => {
    class MockInnerStream extends AbstractStream {
      constructor(private value: string) {
        super();
      }

      override async run(): Promise<void> {
        await this.emit({value: this.value});
        this.isAutoComplete.resolve(true);
      }
    }

    class MockStream extends AbstractStream {
      override async run(): Promise<void> {
        this.isAutoComplete.resolve(true);
      }
    }

    const operator = new ConcatMapOperator(value => new MockInnerStream(value));
    const emissions = [
      'data1',
      'data2',
      'data3',
      'data4',
      'data5',
    ];

    let processedOrder: any[] = [];
    const mockStream = new MockStream();
    const mockNext = {
      process: async (emission: Emission, stream: AbstractStream) => {
        processedOrder.push(emission.value);
        return emission;
      },
    };

    operator.next = mockNext as any;

    for (const emission of emissions) {
      await operator.handle({value: emission}, mockStream);
    }

    expect(processedOrder).toEqual(['data1', 'data2', 'data3', 'data4', 'data5']);
  });


  it('should handle multiple emissions from outer stream and inner stream', async () => {
    class MockInnerStream extends AbstractStream {
      constructor(private values: string[]) {
        super();
      }

      override async run(): Promise<void> {
        for (const value of this.values) {
          await this.emit({ value });
        }
        this.isAutoComplete.resolve(true);
      }
    }

    class MockStream extends AbstractStream {
      override async run(): Promise<void> {
        this.isAutoComplete.resolve(true);
      }
    }

    const outerEmissions = ['outer1', 'outer2'];
    const innerValues1 = ['inner1a', 'inner1b', 'inner1c'];
    const innerValues2 = ['inner2a', 'inner2b', 'inner2c'];

    const projectFunction = (value: any) => {
      if (value === 'outer1') {
        return new MockInnerStream(innerValues1);
      } else if (value === 'outer2') {
        return new MockInnerStream(innerValues2);
      } else {
        return new MockInnerStream([]);
      }
    };

    const results: any[] = [];
    const operator = new ConcatMapOperator(projectFunction);
    const mockStream = new MockStream();
    const mockNext = {
      process: async (emission: Emission, stream: AbstractStream) => {
        results.push(emission.value);
        return emission;
      },
    };

    operator.next = mockNext as any;

    for (const emission of outerEmissions) {
      await operator.handle({value: emission}, mockStream);
    }

    expect(results.length).toEqual(6);
    expect(results).toEqual([
      'inner1a', 'inner1b', 'inner1c',
      'inner2a', 'inner2b', 'inner2c'
    ]);
  });
});

// Example Inner Stream Implementation (Replace with your actual implementation)
class MyInnerStream extends AbstractStream {
  private value: any;

  constructor(value: any) {
    super();
    this.value = value;
  }

  override async run(): Promise<void> {
    // Simulate inner stream behavior (emission, completion, error)
    await new Promise((resolve) => setTimeout(resolve, 10)); // Simulate delay
    this.emit({ value: this.value }); // Emit the projected value
  }
}

// Example Real Stream Implementation (Replace with your actual implementation)
class MyRealStream extends AbstractStream {
  override async run(): Promise<void> {
    // Simulate your real stream behavior (emitting values)
    this.emit({ value: 'streamValue1' });
  }
}

// Example Error Inner Stream Implementation (Replace with your actual implementation)
class ErrorInnerStream extends AbstractStream {
  private value: any;

  constructor(value: any) {
    super();
    this.value = value;
  }

  override async run(): Promise<void> {
    throw new Error('Inner Stream Error');
  }
}

