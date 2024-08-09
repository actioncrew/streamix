export function promisifiedCounter(initialValue: number = 0) {
  let count = initialValue;
  let listener: (() => void) | null = null;
  let unsubscribeMethod: (() => void) | null = null;
  const waitForPromises: { target: number; resolve: () => void }[] = [];

  function innerFunction(): number {
    return count;
  }

  innerFunction.increment = function (step = 1): void {
    count += step;
    notifyListener();
    checkWaitFor();
  };

  innerFunction.decrement = function (step = 1): void {
    count -= step;
    if (count <= 0) {
      notifyListener();
    }
    checkWaitFor();
  };

  innerFunction.subscribe = function (newListener: () => void): () => void {
    if (listener && unsubscribeMethod) {
      return unsubscribeMethod;
    }

    listener = newListener;
    unsubscribeMethod = () => {
      listener = null;
    };

    return unsubscribeMethod;
  };

  innerFunction.unsubscribe = function (): void {
    if (unsubscribeMethod) {
      unsubscribeMethod();
      unsubscribeMethod = null;
    }
  };

  innerFunction.waitFor = function (target: number): Promise<void> {
    if (count === target) {
      return Promise.resolve();
    }

    return new Promise<void>((resolve) => {
      waitForPromises.push({ target, resolve });
      checkWaitFor(); // Check immediately in case the target has already been reached
    });
  };

  function notifyListener() {
    if (listener) {
      listener();
    }
  }

  function checkWaitFor() {
    // Iterate over the promises and resolve those whose target has been met
    for (let i = 0; i < waitForPromises.length; i++) {
      const promiseObj = waitForPromises[i];
      if (count === promiseObj.target) {
        promiseObj.resolve();
        waitForPromises.splice(i, 1); // Remove the resolved promise
        i--; // Adjust the index after removal
      }
    }
  }

  return innerFunction;
}
