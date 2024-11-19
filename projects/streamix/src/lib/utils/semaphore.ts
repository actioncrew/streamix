export type Semaphore = {
  acquire: () => Promise<void>;
  release: () => void;
};

export function createSemaphore(maxCount: number): Semaphore {
  let currentCount = maxCount;
  let pending = 0;

  // Function to create and resolve a pending promise
  let resolvePending: (() => void) | null = null;
  const getNextPromise = (): Promise<void> =>
    new Promise((resolve) => (resolvePending = resolve));

  const acquire = async (): Promise<void> => {
    if (currentCount > 0) {
      currentCount--;
      return;
    }

    pending++;
    await getNextPromise();
  };

  const release = (): void => {
    if (pending > 0) {
      pending--;
      if (resolvePending) {
        resolvePending();
        resolvePending = null; // Ensure the current promise is resolved
      }
    } else {
      currentCount++;
    }
  };

  return { acquire, release };
}
