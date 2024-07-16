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
