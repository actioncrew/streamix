export type Emission<T = any> = {
  value?: T;                 // The payload
  phantom?: boolean;         // Premature completion
  error?: any;               // Error, if applicable
  timestamp: number;
}

// Example function to create an Emission with Promise management
export function createEmission(emission: { value?: any, phantom?: boolean, complete?: boolean, error?: any }) {
  return Object.assign(emission, {
    timestamp: performance.now(),
  });
}
