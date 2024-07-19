// import { AbstractStream, Emission, withLatestFrom } from '../lib';

// // Mock implementation for AbstractStream
// class MockStream extends AbstractStream {
//   private values: any[];
//   private index: number;

//   constructor(values: any[]) {
//     super();
//     this.values = values;
//     this.index = 0;
//   }

//   override async run(): Promise<void> {
//     try {
//       while (this.index < this.values.length && !this.isStopRequested.value) {
//         let emission = { value: this.values[this.index] } as Emission;
//         await this.emit(emission);

//         if (emission.isFailed) {
//           throw emission.error;
//         }

//         this.index++;
//       }
//       this.isAutoComplete.resolve(true);
//     } catch (error) {
//       console.error('Error in MockStream:', error);
//       this.isFailed.resolve(error);
//     } finally {
//       this.isStopped.resolve(true);
//     }
//   }
// }

// describe('withLatestFrom operator', () => {
//   it('should combine emissions with latest value from other stream', (done) => {
//     const mainStream = new MockStream([1, 2, 3]);
//     const otherStream = new MockStream(['A', 'B', 'C']);

//     const combinedStream = mainStream.pipe(withLatestFrom(otherStream));

//     let results: any[] = [];

//     combinedStream.subscribe((value) => {
//       results.push(value);
//     });

//     combinedStream.isStopped.then(() => {
//       expect(results).toEqual([
//         [1, 'A'],
//         [2, 'B'],
//         [3, 'C']
//       ]);
//       done();
//     });
//   });

//   it('should handle cases where other stream emits after main stream', (done) => {
//     const mainStream = new MockStream([1, 2, 3]);
//     const otherStream = new MockStream(['A', 'B', 'C']);

//     const combinedStream = mainStream.pipe(withLatestFrom(otherStream));

//     let results: any[] = [];

//     combinedStream.subscribe((value) => {
//       results.push(value);
//     });

//     combinedStream.isStopped.then(() => {
//       expect(results).toEqual([
//         [1, 'C'], // Main stream emits 1 first, then other stream emits 'C'
//         [2, 'C'], // Main stream emits 2, other stream still emits 'C'
//         [3, 'C']  // Main stream emits 3, other stream still emits 'C'
//       ]);
//       done();
//     });
//   });

//   it('should handle cancellation of the main stream', (done) => {
//     const mainStream = new MockStream([1, 2, 3]);
//     const otherStream = new MockStream(['A', 'B', 'C']);

//     const combinedStream = mainStream.pipe(withLatestFrom(otherStream));

//     let results: any[] = [];

//     combinedStream.subscribe((value) => {
//       results.push(value);
//     });

//     // Cancel the main stream immediately
//     mainStream.terminate();

//     combinedStream.isStopped.then(() => {
//       expect(results).toEqual([]);
//       done();
//     });
//   });

//   it('should handle cancellation of the other stream', (done) => {
//     const mainStream = new MockStream([1, 2, 3]);
//     const otherStream = new MockStream(['A', 'B', 'C']);

//     const combinedStream = mainStream.pipe(withLatestFrom(otherStream));

//     let results: any[] = [];

//     combinedStream.subscribe((value) => {
//       results.push(value);
//     });

//     // Cancel the other stream immediately
//     otherStream.terminate();

//     combinedStream.isStopped.then(() => {
//       expect(results).toEqual([]);
//       done();
//     });
//   });
// });
