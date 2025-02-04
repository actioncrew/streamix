export type Counter = {
  (): number;
  increment(step?: number): void;
  decrement(step?: number): void;
  waitFor(target: number): Promise<void>;
};

export function createCounter(initialValue: number = 0): Counter {
  let count = initialValue;
  const waitForPromises: { target: number; resolve: () => void }[] = [];

  const notifyWaitFor = () => {
    // Resolve all promises where the target has been met
    for (let i = 0; i < waitForPromises.length; i++) {
      const { target, resolve } = waitForPromises[i];
      if (count === target) {
        resolve();
        waitForPromises.splice(i, 1); // Remove the resolved promise
        i--; // Adjust index after removal
      }
    }
  };

  const increment = (step: number = 1): void => {
    count += step;
    notifyWaitFor();
  };

  const decrement = (step: number = 1): void => {
    count -= step;
    notifyWaitFor();
  };

  const waitFor = (target: number): Promise<void> => {
    if (count === target) {
      return Promise.resolve();
    }

    return new Promise<void>((resolve) => {
      waitForPromises.push({ target, resolve });
      notifyWaitFor(); // Check immediately if target is already met
    });
  };

  // The main function returns the current count value
  const counter = () => count;

  counter.increment = increment;
  counter.decrement = decrement;
  counter.waitFor = waitFor;

  return counter;
}

export { createCounter as counter };
