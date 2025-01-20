
export type Receiver<T = any> = {
  next?: (value: T) => void;
  error?: (err: Error) => void;
  complete?: () => void;
};

export interface Subscription {
  (): any;
  subscribed: number;
  unsubscribed: number | undefined;
  unsubscribe(): void;
}

export function createReceiver<T = any>(callbackOrReceiver?: ((value: T) => void) | Receiver<T>): Receiver<T> {
  const receiver = (typeof callbackOrReceiver === 'function') ?
    { next: callbackOrReceiver } :
    callbackOrReceiver || {};

  receiver.next = receiver.next ?? (() => {});
  receiver.error = receiver.error ?? ((err) => console.error('Unhandled error:', err));
  receiver.complete = receiver.complete ?? (() => {});

  return receiver;
}

export const createSubscription = function <T>(getValue: () => T, unsubscribe?: () => void): Subscription {

  const subscription = () => getValue();

  unsubscribe = unsubscribe ?? (function(this: Subscription) { this.unsubscribed = performance.now(); });

  return Object.assign(subscription, {
    subscribed: performance.now(),
    unsubscribed: undefined,
    unsubscribe
  }) as any;
};


type Stream<T> = (next: ((value: T) => void) | Receiver<T>) => Subscription;
type Emission<T> = { value: T; phantom?: boolean; pending?: boolean; error?: any };

type StreamOperator<T, U> = (stream: Stream<T>) => Stream<U>;

interface Operator<T, U> {
  handle: (emission: Emission<T>) => Emission<U>;
  name: string;
}

export const map = <T, U>(fn: (value: T) => U): Operator<T, U> => ({
  name: 'map',
  handle: (emission: Emission<T>) => ({
    value: fn(emission.value),
  }),
});

export const filter = <T>(predicate: (value: T) => boolean): Operator<T, T> => ({
  name: 'filter',
  handle: (emission: Emission<T>) => {
    return predicate(emission.value) ? emission : { ...emission, phantom: true };
  },
});

export const defer = <T>(factory: () => Stream<T>): StreamOperator<T, T> => {
  return (stream: Stream<T>) => {
    return (nextOrReceiver: ((value: T) => void) | Receiver<T>) => {
      return stream(() => {
        const deferredStream = factory();
        deferredStream(nextOrReceiver);
      });
    };
  };
};

// Higher-order operator for switching streams
export const mergeMap = <T, U>(fn: (value: T) => Stream<U>): StreamOperator<T, U> => {
  return (stream: Stream<T>) => {
    return (nextOrReceiver: ((value: U) => void) | Receiver<U>) => {
      return stream((value: T) => {
        const innerStream = fn(value);
        innerStream(nextOrReceiver);
      });
    };
  };
};

export const concatMap = <T, U>(fn: (value: T) => Stream<U>): StreamOperator<T, U> => {
  return (stream: Stream<T>) => {
    let activeInnerStream: Subscription | null = null;

    return (nextOrReceiver: ((value: U) => void) | Receiver<U>) => {
      const next = typeof nextOrReceiver === 'function' ? nextOrReceiver : nextOrReceiver.next;
      return stream((value: T) => {
        const innerStream = fn(value);

        const subscribeInner = () => {
          activeInnerStream = innerStream((innerValue: U) => {
            next!(innerValue);
          });
        };

        if (activeInnerStream) {
          activeInnerStream.unsubscribe();
        }
        subscribeInner();
      });
    };
  };
};

export const switchMap = <T, U>(fn: (value: T) => Stream<U>): StreamOperator<T, U> => {
  return (stream: Stream<T>) => {
    let currentInnerStream: Stream<U> | null = null;
    let subscription: Subscription | null = null;

    return (nextOrReceiver: ((value: U) => void) | Receiver<U>) => {
      const unsubscribeFromInner = () => {
        if (subscription) {
          subscription.unsubscribe();
          currentInnerStream = null;
        }
      };

      return stream((value: T) => {
        unsubscribeFromInner();
        currentInnerStream = fn(value);
        subscription = currentInnerStream!(nextOrReceiver);
      });
    };
  };
};

export const noop = () => {};

export const catchError = <T>(handler: (error: any) => Emission<T>): Operator<T, T> => ({
  name: 'catchError',
  handle: (emission: Emission<T>) => {
    if (emission.error) {
      return handler(emission.error);
    }
    return emission;
  },
});

export const delay = <T>(ms: number): StreamOperator<T, T> => {
  return (stream: Stream<T>) => {
    return (nextOrReceiver: ((value: T) => void) | Receiver<T>) => {
      const next = typeof nextOrReceiver === 'function' ? nextOrReceiver : nextOrReceiver.next;
      let timerId: any = null;

      const clearTimer = () => {
        if (timerId) {
          clearTimeout(timerId);
          timerId = null;
        }
      };

      return stream((value: T) => {
        clearTimer();
        timerId = setTimeout(() => {
          next!(value);
        }, ms);
      });
    };
  };
};

export function fromArray<T>(arr: T[]): Stream<T> {
  return (nextOrReceiver: ((value: T) => void) | Receiver<T>) => {
    const next = typeof nextOrReceiver === 'function' ? nextOrReceiver : nextOrReceiver.next;
    let index = 0; let currentValue: any = undefined;
    const interval = setInterval(() => {
      if (index < arr.length) {
        currentValue = arr[index];
        next!(currentValue);
        index++;
      } else {
        clearInterval(interval);
      }
    }, 0);

    return createSubscription(
      () => currentValue,
      function (this: Subscription) {
        this.unsubscribed = performance.now();
        clearInterval(interval);
      }
    );
  };
}

export const pipe = <T, U>(...operators: Operator<any, any>[]): StreamOperator<T, U> => {
  return (stream: Stream<T>) => {
    return (nextOrReceiver: ((value: U) => void) | Receiver<U>) => {
      const next = typeof nextOrReceiver === 'function' ? nextOrReceiver : nextOrReceiver.next;

      return stream((value: T) => {
        let currentEmission: Emission<any> = { value };

        // Apply each operator in sequence
        for (const operator of operators) {
          currentEmission = operator.handle(currentEmission);
          if (currentEmission.error) {
            break;
          }
        }

        // Emit the final value if there's no error
        if (!currentEmission.error && !currentEmission.phantom) {
          next!(currentEmission.value);
        }
      });
    };
  };
};

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
    const source: Stream<number> = (nextOrReceiver) => {
      const next = typeof nextOrReceiver === 'function' ? nextOrReceiver : nextOrReceiver.next;

      [1, 2, 3].forEach((value) => next!(value));
      return createSubscription(() => {});
    };

    // First pipe with SimpleOperators
    const firstPipe = pipe(
      map((value) => value * 2), // Double the value
      filter((value) => value > 2) // Allow only values greater than 2
    );

    // MergeMap Operator
    const mergeMapOperator = mergeMap((value: number) => {
      const innerValues = [1, 2, 3].map((v) => v + value);
      const innerStream: Stream<number> = (nextOrReceiver) => {
        const next = typeof nextOrReceiver === 'function' ? nextOrReceiver : nextOrReceiver.next!;
        innerValues.forEach(next);
        return createSubscription(() => {});
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
    combinedStream((value) => {
      results.push(value);
      if (results.length === 6) {
        done();
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

    combinedStream1((value) => {
      results.push(value);
      if (results.length === expectedResults.length) {
        expect(results).toEqual(expectedResults);
        done();
      }
    });
  });
});
