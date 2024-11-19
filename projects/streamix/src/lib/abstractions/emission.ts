
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
  resolve: () => Promise<void>;
  reject: (reason: any) => Promise<void>;
  wait: () => Promise<void>;
  link: (child: Emission) => void;
  finalize(): void;
  notifyOnCompletion(child: Emission): void;
  notifyOnError(child: Emission, error: any): void;
}

// Example function to create an Emission with Promise management
export function createEmission({ value, phantom, failed, pending, complete, error }:
  { value?: any, phantom?: boolean, failed?: boolean, pending?: boolean, complete?: boolean, error?: any }) {
  let resolveFn: (value: any) => void;
  let rejectFn: (reason: any) => void;
  let completion = new Promise<void>((resolve, reject) => {
    resolveFn = resolve;
    rejectFn = reject;
  });

  const instance: Emission = {
    resolve: () => {
      if (resolveFn) {
        delete instance.pending;
        instance.complete = true;

        resolveFn(value);

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
    },
    notifyOnCompletion: (child: Emission): void => {
      if(instance.finalized) {
        const descendants = Array.from(instance.descendants || []);
        const allResolved = descendants.every(descendant => descendant.complete || descendant.failed || descendant.phantom);
        const shouldFail = descendants.some(descendant => descendant.failed);
        const shouldComplete = !shouldFail && allResolved;

        if(allResolved) {
          instance.complete = true;
        }

        if(shouldFail) {
          const error = new Error("One or more child emission failed");
          instance.reject(error.message);
          instance.ancestor && instance.ancestor.notifyOnError(instance, error);
        }

        if(shouldComplete) {
          instance.resolve();
        }
      }
    },
    notifyOnError: (child: Emission, reason: any): void => {
      if(instance.finalized) {
        const descendants = Array.from(instance.descendants || []);
        const allResolved = descendants.every(descendant => descendant.complete || descendant.failed || descendant.phantom);
        const shouldFail = true;
        const shouldComplete = !shouldFail && allResolved;

        if(allResolved) {
          instance.complete = true;
        }

        if(shouldFail) {
          instance.reject(reason.message);
          instance.ancestor && instance.ancestor.notifyOnError(instance, reason);
        }

        if(shouldComplete) {
          instance.resolve();
        }
      }
    }
  };

  // Conditionally set properties if they are provided
  if (value !== undefined) instance.value = value;
  if (phantom !== undefined) instance.phantom = phantom;
  if (failed !== undefined) instance.failed = failed;
  if (pending !== undefined) instance.pending = pending;
  if (complete !== undefined) instance.complete = complete;
  if (error !== undefined) instance.error = error;

  return instance;
}
