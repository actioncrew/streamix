
type Stream<T> = (next: (emission: Emission<T>) => void) => () => void;
type Emission<T> = { value: T; phantom?: boolean; pending?: boolean; error?: any };

type StreamOperator<T, U> = (stream: Stream<T>) => Stream<U>;

interface Operator<T, U> {
  handle: (emission: Emission<T>) => Emission<U>;
  name: string;
}

const map = <T, U>(fn: (value: T) => U): Operator<T, U> => ({
  name: 'map',
  handle: (emission: Emission<T>) => ({
    value: fn(emission.value),
  }),
});

const filter = <T>(predicate: (value: T) => boolean): Operator<T, T> => ({
  name: 'filter',
  handle: (emission: Emission<T>) => {
    return predicate(emission.value) ? emission : { ...emission, phantom: true };
  },
});

const defer = <T>(factory: () => Stream<T>): StreamOperator<T, T> => {
  return (stream: Stream<T>) => {
    return (next: (value: Emission<T>) => void) => {
      return stream((emission: Emission<T>) => {
        if (!emission.error && !emission.phantom && !emission.pending) {
          const deferredStream = factory();
          deferredStream(next);
        }
      });
    };
  };
};

// Higher-order operator for switching streams
const mergeMap = <T, U>(fn: (value: T) => Stream<U>): StreamOperator<T, U> => {
  return (stream: Stream<T>) => {
    return (next: (emission: Emission<U>) => void) => {
      return stream((emission: Emission<T>) => {
        if (!emission.error && !emission.phantom) {
          const innerStream = fn(emission.value); // Generate inner stream
          innerStream(next); // Flatten inner stream emissions into the main stream
        }
      });
    };
  };
};

const concatMap = <T, U>(fn: (value: T) => Stream<U>): StreamOperator<T, U> => {
  return (stream: Stream<T>) => {
    let activeInnerStream: any = null;

    return (next: (emission: Emission<U>) => void) => {
      return stream((emission: Emission<T>) => {
        if (!emission.error && !emission.phantom && !emission.pending) {
          const innerStream = fn(emission.value);

          const subscribeInner = () => {
            activeInnerStream = innerStream((innerEmission) => {
              if (!innerEmission.error && !innerEmission.phantom && !emission.pending) {
                next(innerEmission);
              }
            });
          };

          if (activeInnerStream) {
            activeInnerStream.add(subscribeInner);
          } else {
            subscribeInner();
          }
        }
      });
    };
  };
};

const switchMap = <T, U>(fn: (value: T) => Stream<U>): StreamOperator<T, U> => {
  return (stream: Stream<T>) => {
    let currentInnerStream: Stream<U> | null = null;

    return (next: (emission: Emission<U>) => void) => {
      const unsubscribeFromInner = () => {
        if (currentInnerStream) {
          currentInnerStream(noop); // Unsubscribe from previous inner stream
          currentInnerStream = null;
        }
      };

      return stream((emission: Emission<T>) => {
        if (!emission.error && !emission.phantom) {
          unsubscribeFromInner(); // Unsubscribe from previous inner stream
          currentInnerStream = fn(emission.value); // Create new inner stream
          currentInnerStream(next); // Subscribe to the new inner stream
        }
      });
    };
  };
};

const noop = () => {};

const catchError = <T>(handler: (error: any) => Emission<T>): Operator<T, T> => ({
  name: 'catchError',
  handle: (emission: Emission<T>) => {
    if (emission.error) {
      return handler(emission.error);
    }
    return emission;
  },
});

const delay = <T>(ms: number): StreamOperator<T, T> => {
  return (stream: Stream<T>) => {
    let timerId: any = null;

    return (next: (emission: Emission<T>) => void) => {
      const clearTimer = () => {
        if (timerId) {
          clearTimeout(timerId);
          timerId = null;
        }
      };

      return stream((emission: Emission<T>) => {
        if (!emission.error && !emission.phantom) {
          clearTimer();
          timerId = setTimeout(() => {
            next(emission);
          }, ms);
        }
      });
    };
  };
};

function fromArray<T>(arr: T[]): Stream<T> {
  return (next: (value: Emission<T>) => void): (() => void) => {
    let index = 0;
    const interval = setInterval(() => {
      if (index < arr.length) {
        next({ value: arr[index] });
        index++;
      } else {
        clearInterval(interval);
      }
    }, 0);

    return () => {
      clearInterval(interval);
    };
  };
}

const pipe = <T, U>(...operators: Operator<any, any>[]): StreamOperator<T, U> => {
  return (stream: Stream<T>) => {
    return (next: (emission: Emission<U>) => void) => {
      return stream((emission: Emission<any>) => {
        let currentEmission = emission;

        // Apply each operator in sequence
        for (const operator of operators) {
          currentEmission = operator.handle(currentEmission);
          if (currentEmission.error) {
            break;
          }
        }

        next(currentEmission);
      });
    };
  };
};

// const pipe = <T, U>(...operators: SimpleOperator<any, any>[]): Operator<T, U> => {
//   return (stream: Stream<T>) => {
//     return (next: (value: Emission<U>) => void) => {
//       let isActive = true;
//       const output: Stream<any> = (innerNext) => {
//         return stream((emission: Emission<any>) => {
//           if (!emission.error && !emission.phantom && !emission.pending && isActive) {
//             try {
//               let currentEmission = emission;
//               for (let i = 0; i < operators.length; i++) {
//                 const operator = operators[i];
//                 if ('type' in operators[i] && operators[i].type === "catchError") {
//                   continue;
//                 }
//                 currentEmission = operator.handle(currentEmission);
//                 if (currentEmission.error) {
//                   let foundCatchError = false;
//                   for (let j = i + 1; j < operators.length; j++) {
//                     if ('type' in operators[j] && operators[j].type === "catchError") {
//                       foundCatchError = true;
//                       currentEmission = operators[j].handle(currentEmission);
//                       break;
//                     }
//                   }
//                   if (!foundCatchError) {
//                     innerNext({ ...currentEmission });
//                     return;
//                   }
//                 }
//               }
//               innerNext(currentEmission);
//             } catch (error) {
//               innerNext({ ...emission, error });
//             }
//           }
//         });
//       };

//       return () => {
//         isActive = false;
//         return output(next);
//       };
//     };
//   };
// }

// The 'compose' function to combine multiple Operators into one
const compose = <T, U>(...operators: StreamOperator<any, any>[]): StreamOperator<T, U> => {
  return (stream: Stream<T>) => {
    return operators.reduce((acc, currentOperator) => currentOperator(acc), stream) as unknown as Stream<U>;
  };
};

// The chain function combining SimpleOperator groups and Operators
const chain = <T, U>(...steps: (Operator<any, any> | StreamOperator<any, any>)[]): StreamOperator<T, U> => {
  return (stream: Stream<T>) => {
    let combinedStream: Stream<any> = stream;
    let currentSimpleOperators: Operator<any, any>[] = [];

    // Loop through all steps and group SimpleOperators together
    for (const step of steps) {
      if ('handle' in step) {
        // If it's a SimpleOperator, collect them in the current group
        currentSimpleOperators.push(step);
      } else if (typeof step === 'function') {
        // If it's an Operator (like mergeMap), apply the SimpleOperator group first
        if (currentSimpleOperators.length > 0) {
          // Apply all accumulated SimpleOperators as a group
          combinedStream = pipe(...currentSimpleOperators)(combinedStream);
          currentSimpleOperators = []; // Reset the group
        }

        // Now apply the Operator like mergeMap
        combinedStream = step(combinedStream);
      } else {
        throw new Error("Invalid step provided to chain.");
      }
    }

    // After all steps, if there are any remaining SimpleOperators, apply them
    if (currentSimpleOperators.length > 0) {
      combinedStream = pipe(...currentSimpleOperators)(combinedStream);
    }

    return combinedStream as Stream<U>;
  };
};

// Example usage
describe("adsasjdkasjdlas", () => {
  it("should emit values from stream", (done) => {
    const source: Stream<number> = (next) => {
      [1, 2, 3].forEach((value) => next({ value }));
      return () => {};
    };

    // First pipe with SimpleOperators
    const firstPipe = pipe(
      map((value) => value * 2), // Double the value
      filter((value) => value > 2) // Allow only values greater than 2
    );

    // MergeMap Operator
    const mergeMapOperator = mergeMap((value: number) => {
      const innerValues = [1, 2, 3].map((v) => ({ value: v + value }));
      const innerStream: Stream<number> = (innerNext) => {
        innerValues.forEach(innerNext);
        return () => {};
      };
      return innerStream;
    });

    // Second pipe with SimpleOperators
    const secondPipe = pipe(
      map((value) => value + 10), // Add 10 to each value
      catchError(() => ({value: 0}))
    );

    // Combine everything using compose
    const combinedOperator = compose(
      firstPipe,       // Apply first pipe
      mergeMapOperator, // Switch to a new stream with mergeMap
      secondPipe       // Apply second pipe
    );

    // Apply the composed operator to the source stream
    const combinedStream = combinedOperator(source);

    let results = [];
    // Consume the stream
    combinedStream((emission) => {
      if (!emission.error) {
        results.push(emission.value);
        console.log(emission.value); // Logs the final transformed values
        if (results.length === 6) {
          done();
        }
      } else {
        console.error("Error:", emission.error);
      }
    });
  });

  it("should chain operators and produce correct results", (done) => {
    const source1 = fromArray([1, 2, 3]);

    const combinedStream1 = chain(
      map((value) => value * 2),          // Double the value
      filter((value) => value > 2),      // Filter out values <= 2
      mergeMap((value) => fromArray([value, value + 1])), // Expand each value into two
      map((value) => value + 10)         // Add 10 to each value
    )(source1);

    const expectedResults = [14, 15, 16, 17]; // Expected output
    const results: any[] = [];

    combinedStream1((emission) => {
      if (!emission.error) {
        results.push(emission.value);
        console.log(emission.value); // Outputs processed values
        if (results.length === expectedResults.length) {
          expect(results).toEqual(expectedResults);
          done();
        }
      }
    });
  });
});
