
export type Emission = {
  value?: any;                 // The payload
  phantom?: boolean;           // Premature completion
  failed?: boolean;            // Indicates failure
  pending?: boolean;           // Indicates pending processing
  complete?: boolean;          // Completion state
  error?: any;                 // Error, if applicable
  ancestor?: Emission;         // Emission that is pending and ancest this instance
  descendants?: Set<Emission>; // Track all descendants
  resolve: () => Promise<void>;
  reject: (reason: any) => Promise<void>;
  wait: () => Promise<void>;
  link: (child: Emission) => void;
}

// Example function to create an Emission with Promise management
export function createEmission(value?: any) {
  let resolveFn: (value: any) => void;
  let rejectFn: (reason: any) => void;
  let completion = new Promise<void>((resolve, reject) => {
    resolveFn = resolve;
    rejectFn = reject;
  });

  const instance: Emission = {
    value,
    resolve: () => {
      if (resolveFn) {
        delete instance.pending;
        instance.complete = true;

        resolveFn(value);

        if(instance.ancestor) {
          delete instance.ancestor.pending;
          instance.ancestor.complete = true;
          instance.ancestor.resolve();
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
          delete instance.ancestor.pending;
          instance.ancestor.reject(reason);
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
    }
  };

  return instance;
}
