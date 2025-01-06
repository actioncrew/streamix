export type Emission = {
  value?: any;                 // The payload
  phantom?: boolean;           // Premature completion
  pending?: boolean;           // Indicates pending processing
  complete?: boolean;          // Completion state
  finalized?: boolean;         // No further child emissions
  error?: any;                 // Error, if applicable
  ancestor?: Emission;         // Emission that is pending and ancest this instance
  descendants?: Set<Emission>; // Track all descendants
  timestamp: number | undefined;
  resolve: () => Promise<void>;
  reject: (reason: any) => Promise<void>;
  wait: () => Promise<void>;
  link: (child: Emission) => void;
  finalize(): void;
  root(): Emission;
}

// Example function to create an Emission with Promise management
export function createEmission(emission: { value?: any, phantom?: boolean, pending?: boolean, complete?: boolean, error?: any }) {
  let resolveFn: (value: any) => void;
  let rejectFn: (reason: any) => void;
  let completion = new Promise<void>((resolve, reject) => {
    resolveFn = resolve;
    rejectFn = reject;
  });

  const processDescendants = function (emission: Emission) {
    const descendants = Array.from(emission.descendants || []);
    const allResolved = descendants.every(descendant => descendant.complete || descendant.error || descendant.phantom);
    const shouldFail = descendants.some(descendant => descendant.error);

    if (allResolved) {
      delete emission.pending;
      emission.complete = true;
    }

    if (shouldFail) {
      const error = new Error("One or more child emissions failed");
      emission.reject(error);
    } else if (allResolved) {
      emission.resolve();
    }
  }

  const instance: Emission = Object.assign(emission, {
    timestamp: undefined,
    root () {
      let current = emission as Emission;
      while (current.ancestor) {
        current = current.ancestor;
      }
      return current;
    },
    resolve: function (this: Emission & { notifyOnCompletion: () => void; }) {
      if (resolveFn) {
        delete this.pending;
        this.complete = true;

        resolveFn(emission.value);
        this.notifyOnCompletion();
      }
      return completion;
    },
    reject: function (this: Emission & { notifyOnError: () => void; }, reason: any) {
      if (rejectFn) {
        delete this.pending;
        this.complete = true;
        this.error = reason;

        rejectFn(reason);
        this.notifyOnError();
      }
      return completion;
    },
    wait: () => completion,
    link: (emission: Emission): void => {
      instance.descendants = instance.descendants || new Set();
      emission.ancestor = instance;
      instance.descendants.add(emission);
    },
    finalize: (): void => {
      instance.finalized = true;
      processDescendants(instance);
    },
    notifyOnCompletion: (): void => {
      if(instance.ancestor?.finalized) {
        processDescendants(instance.ancestor);
      }
    },
    notifyOnError: (): void => {
      if(instance.ancestor?.finalized) {
        processDescendants(instance.ancestor);
      }
    }
  });

  return instance;
}
