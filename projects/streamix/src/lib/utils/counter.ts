export function promisifiedCounter(initialValue: number = 0) {
  let count = initialValue;
  let listener: (() => void) | null = null;
  let unsubscribeMethod: (() => void) | null = null;

  async function innerFunction(): Promise<number> {
    return count;
  }

  innerFunction.increment = async function (): Promise<void> {
    count++;
  };

  innerFunction.decrement = async function (): Promise<void> {
    count--;
    if (count <= 0) {
      notifyListener();
    }
  };

  innerFunction.getCount = async function (): Promise<number> {
    return count;
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

  function notifyListener() {
    if (listener) {
      listener();
    }
  }

  return innerFunction;
}
