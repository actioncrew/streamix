import { createOperator } from "../abstractions";

export const withLatestFrom = (...streams: any[]) =>
  createOperator("withLatestFrom", (source) => {
    const latestValues = new Array(streams.length).fill(undefined);
    const hasValue = new Array(streams.length).fill(false);
    let listening = true;

    // Subscribe to all other streams and update latest values
    const subscriptions = streams.map((stream, index) =>
      stream.subscribe({
        next: (val) => {
          latestValues[index] = val;
          hasValue[index] = true;
        },
        error: () => {
          listening = false;
        },
        complete: () => {},
      })
    );

    return {
      async next() {
        if (!listening) return { done: true, value: undefined };

        const result = await source.next();
        if (result.done) {
          listening = false;
          subscriptions.forEach((sub) => sub.unsubscribe());
          return { done: true, value: undefined };
        }

        if (hasValue.every(Boolean)) {
          return {
            done: false,
            value: [result.value, ...latestValues],
          };
        }

        // If not all values are ready yet, just skip this pull
        return this.next();
      }
    };
  });
