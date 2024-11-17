
export type Emission = {
  value?: any;                 // The payload
  phantom?: boolean;         // Premature completion
  failed?: boolean;          // Indicates failure
  pending?: boolean;         // Indicates pending processing
  complete?: boolean;        // Completion state
  error?: any;                 // Error, if applicable
  resolve: () => Promise<void>;
  reject: (reason: any) => Promise<void>;
  wait: () => Promise<void>;
}

// Example function to create an Emission with Promise management
export function emission(value?: any) {
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
      }
      return completion;
    },
    reject: (reason: any) => {
      if (rejectFn) {
        delete instance.pending;
        instance.failed = true;
        instance.error = reason;
        rejectFn(reason);
      }
      return completion;
    },
    wait: () => completion,
  };

  return instance;
}
