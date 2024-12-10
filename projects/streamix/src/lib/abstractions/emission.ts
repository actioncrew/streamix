import { timestamp } from 'rxjs';
export type Emission = {
  value?: any;                 // The payload
  phantom?: boolean;           // Premature completion
  failed?: boolean;            // Indicates failure
  pending?: boolean;           // Indicates pending processing
  complete?: boolean;          // Completion state
  finalized?: boolean;         // No further child emissions
  error?: any;                 // Error, if applicable
  ancestor?: Emission;         // Emission that is pending and ancest this instance
  descendants?: Set<Emission>; // Track all descendants
  timestamp: number;
  resolve: () => Promise<void>;
  reject: (reason: any) => Promise<void>;
  wait: () => Promise<void>;
  link: (child: Emission) => void;
  finalize(): void;
  notifyOnCompletion(child: Emission): void;
  notifyOnError(child: Emission, error: any): void;
  root(): Emission;
}

// Example function to create an Emission with Promise management
export function createEmission(emission: { value?: any, phantom?: boolean, failed?: boolean, pending?: boolean, complete?: boolean, error?: any }) {
  let resolveFn: (value: any) => void;
  let rejectFn: (reason: any) => void;
  let completion = new Promise<void>((resolve, reject) => {
    resolveFn = resolve;
    rejectFn = reject;
  });

  const processDescendants = function (emission: Emission) {
    const descendants = Array.from(emission.descendants || []);
    const allResolved = descendants.every(descendant => descendant.complete || descendant.failed || descendant.phantom);
    const shouldFail = descendants.some(descendant => descendant.failed);

    if (allResolved) {
      delete emission.pending;
      emission.complete = true;
    }

    if (shouldFail) {
      const error = new Error("One or more child emissions failed");
      emission.reject(error);
      emission.ancestor?.notifyOnError(emission, error);
    } else if (allResolved) {
      emission.resolve();
    }
  }

  const instance: Emission = Object.assign(emission, {
    timestamp: performance.now(),
    root () {
      let current = emission as Emission;
      while (current.ancestor) {
        current = current.ancestor;
      }
      return current;
    },
    resolve: () => {
      if (resolveFn) {
        delete instance.pending;
        instance.complete = true;

        resolveFn(emission.value);

        if(instance.ancestor) {
          instance.ancestor.notifyOnCompletion(instance);
        }
      }
      return completion;
    },
    reject: (reason: any) => {
      if (rejectFn) {
        delete instance.pending;
        instance.failed = true;
        instance.error = reason;

        if(instance.ancestor) {
          instance.ancestor.notifyOnError(instance, reason);
        }

        rejectFn(reason);
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
    notifyOnCompletion: (child: Emission): void => {
      if(instance.finalized) {
        processDescendants(instance);
      }
    },
    notifyOnError: (child: Emission, reason: any): void => {
      if(instance.finalized) {
        processDescendants(instance);
      }
    }
  });

  return instance;
}
