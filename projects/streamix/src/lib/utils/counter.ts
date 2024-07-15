export class PromisifiedCounter {
  private count: number;
  private maxSubscribers: number;
  private listeners: (() => void)[] = [];

  constructor(initialValue: number = 0, maxSubscribers: number = Infinity) {
    this.count = initialValue;
    this.maxSubscribers = maxSubscribers;
  }

  // Increment the counter
  async increment(): Promise<void> {
    this.count++;
  }

  // Decrement the counter
  async decrement(): Promise<void> {
    this.count--;
    if (this.count <= 0) {
      this.notifyListeners();
    }
  }

  // Get the current value of the counter
  async getCount(): Promise<number> {
    return this.count;
  }

  // Subscribe to the zero event
  subscribe(listener: () => void): () => void {
    if (this.listeners.length < this.maxSubscribers) {
      this.listeners.push(listener);
      return () => {
        this.listeners = this.listeners.filter(l => l !== listener);
      };
    } else {
      return () => {
        this.listeners.pop();
      };
    }
  }

  private notifyListeners() {
    this.listeners.forEach(listener => listener());
  }
}
