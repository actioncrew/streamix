export function promisifiedCounter(initialValue: number = 0) {
  let count = initialValue;
  let listener: (() => void) | null = null;
  let unsubscribeMethod: (() => void) | null = null;
  const waitForPromises: { target: number; resolve: () => void }[] = [];

  function innerFunction(): number {
    return count;
  }

  innerFunction.increment = function (): void {
    count++;
    notifyListener();
    checkWaitFor();
  };

  innerFunction.decrement = function (): void {
    count--;
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
      checkWaitFor();
    });
  };

  function notifyListener() {
    if (listener) {
      listener();
    }
  }

  function checkWaitFor() {
    const satisfied = waitForPromises.filter(promiseObj => count === promiseObj.target);
    waitForPromises.length = 0;
    satisfied.forEach(promiseObj => promiseObj.resolve());
  }

  return innerFunction;
}
