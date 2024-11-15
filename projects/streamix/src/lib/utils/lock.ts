// Define a functional lock for synchronizing access
export function createLock() {
  let promise = Promise.resolve();

  async function acquire() {
    const release = promise; // Wait on the current promise
    let resolve: () => void;
    promise = new Promise<void>((res) => (resolve = res!)); // Create a new promise for the next lock acquisition
    await release; // Wait for the previous promise to resolve
    return resolve!; // Return the resolve function
  }

  return { acquire };
}
