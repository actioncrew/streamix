export class AbstractHook {
  callbacks: ((params?: any) => void | Promise<void>)[] = [];

  async process(params?: any): Promise<void> {
    for (const callback of this.callbacks) {
      await callback(params);
    }
  }

  chain(callback: (params?: any) => void | Promise<void>): void {
    this.callbacks.push(callback);
  }

  clear(): void {
    this.callbacks = [];
  }
}

