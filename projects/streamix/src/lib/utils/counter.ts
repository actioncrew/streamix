export class PromisifiedCounter {
  private count: number;
  private listener: (() => void) | null = null;
  private unsubscribeMethod: (() => void) | null = null;

  constructor(initialValue: number = 0) {
    this.count = initialValue;
  }

  // Increment the counter
  async increment(): Promise<void> {
    this.count++;
  }

  // Decrement the counter
  async decrement(): Promise<void> {
    this.count--;
    if (this.count <= 0) {
      this.notifyListener();
    }
  }

  // Get the current value of the counter
  async getCount(): Promise<number> {
    return this.count;
  }

  // Subscribe to the zero event
  subscribe(listener: () => void): () => void {
    if (this.listener && this.unsubscribeMethod) {
      return this.unsubscribeMethod;
    }

    this.listener = listener;
    this.unsubscribeMethod = () => {
      this.listener = null;
    };

    return this.unsubscribeMethod;
  }

  // Unsubscribe the listener
  unsubscribe(): void {
    if (this.unsubscribeMethod) {
      this.unsubscribeMethod();
      this.unsubscribeMethod = null;
    }
  }

  private notifyListener() {
    if (this.listener) {
      this.listener();
    }
  }
}

function promisifiedCounter(initialValue: number = 0) {
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
