import { AbstractStream, Emission, mergeMap } from '../lib';

// Mock AbstractStream implementation for testing purposes
class MockStream extends AbstractStream {
  private values: any[];
  private index: number;

  constructor(values: any[]) {
    super();
    this.values = values;
    this.index = 0;
  }

  override async run(): Promise<void> {
    while (this.index < this.values.length && !this.isStopRequested.value) {
      let emission = { value: this.values[this.index] } as Emission;
      await this.emit(emission);

      if(emission.isFailed) {
        throw emission.error;
      }
      this.index++;
    }
    if(!this.isStopRequested.value) {
      this.isAutoComplete.resolve(true);
    }
  }
}

describe('mergeMap operator', () => {
  it('should merge emissions from inner streams correctly', (done) => {
    const testStream = new MockStream([1,2,3]);

    const project = (value: number) => new MockStream([value * 2, value * 4]);

    const mergedStream = testStream.pipe(mergeMap(project));

    let results: any[] = [];

    mergedStream.subscribe((value) => {
      results.push(value);
    });

    mergedStream.isStopped.then(() => {
      expect(results).toEqual([2, 4, 4, 8, 6, 12]);
      done();
    });
  });

  // it('should handle inner stream cancellation', (done) => {
  //   const testStream = new MockStream([1, 2, 3]);

  //   const project = (value: number) => {
  //     const innerStream = new MockStream([value, value * 2]);
  //     setTimeout(() => innerStream.terminate(), 10); // Cancel inner stream after a delay
  //     return innerStream;
  //   };

  //   const mergedStream = testStream.pipe(mergeMap(project));

  //   let results: any[] = [];

  //   mergedStream.subscribe((value) => {
  //     results.push(value);
  //   });

  //   mergedStream.isStopped.then(() => {
  //     expect(results).toEqual([1, 2]); // Only first inner stream emissions should be processed
  //     done();
  //   });
  // });

  // it('should handle errors in inner streams', (done) => {
  //   const testStream = new MockStream([1, 2, 3]);

  //   const project = (value: number) => {
  //     if (value === 2) {
  //       throw new Error('Error in inner stream');
  //     }
  //     return new MockStream([value, value * 2]);
  //   };

  //   const mergedStream = testStream.pipe(mergeMap(project));

  //   let results: any[] = [];

  //   mergedStream.subscribe((value) => {
  //     results.push(value);
  //   });

  //   mergedStream.isStopped.then(() => {
  //     expect(results).toEqual([1, new Error('Error in inner stream'), 3, 6]);
  //     done();
  //   });
  // });
});
