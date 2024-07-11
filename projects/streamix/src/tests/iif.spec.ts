import { AbstractOperator, AbstractStream, Emission, iif } from '../lib';

// Mock implementations for testing
class MockStream extends AbstractStream {
  private values: any[];
  private index: number;

  constructor(values: any[]) {
    super();
    this.values = values;
    this.index = 0;
  }

  async run(): Promise<void> {
    try {
      while (this.index < this.values.length && !this.isStopRequested.value) {
        await this.emit({ value: this.values[this.index] });
        this.index++;
      }
      this.isAutoComplete.resolve(true);
    } catch (error) {
      console.error('Error in MockStream:', error);
    } finally {
      this.isStopped.resolve(true);
    }
  }
}

class MockEmission implements Emission {
  value: any;
  isPhantom: boolean;
  isCancelled: boolean;
  isFailed: boolean;

  constructor(value: any) {
    this.value = value;
    this.isPhantom = false;
    this.isCancelled = false;
    this.isFailed = false;
  }
}

class MockOperator extends AbstractOperator {
  async handle(emission: Emission, stream: AbstractStream): Promise<any> {
    return Promise.resolve(emission);
  }
}

describe('iif operator', () => {
  it('should choose trueStream when condition is true', (done) => {
    const condition = (emission: Emission) => emission.value > 5;
    const trueStream = new MockStream([10, 20, 30]);
    const falseStream = new MockStream([1, 2, 3]);

    const operator = iif(condition, trueStream, falseStream);

    const testEmission = new MockEmission(10);

    operator.handle(testEmission, new MockStream([])).then((result: any) => {
      expect(result).toBe(trueStream);
      done();
    });
  });

  it('should choose falseStream when condition is false', (done) => {
    const condition = (emission: Emission) => emission.value > 5;
    const trueStream = new MockStream([10, 20, 30]);
    const falseStream = new MockStream([1, 2, 3]);

    const operator = iif(condition, trueStream, falseStream);

    const testEmission = new MockEmission(2);

    operator.handle(testEmission, new MockStream([])).then((result: any) => {
      expect(result).toBe(falseStream);
      done();
    });
  });
});
