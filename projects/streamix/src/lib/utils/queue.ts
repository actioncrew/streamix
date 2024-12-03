export type Queue<T> = {
  enqueue: (value: T) => void;
  dequeue: () => Promise<T>;
};

export const createQueue = <T>(): Queue<T> => {
  let items: T[] = [];
  let resolveList: Array<(value: T) => void> = [];

  return {
    enqueue(value: T) {
      if (resolveList.length > 0) {
        const resolve = resolveList.shift();
        resolve && resolve(value);
      } else {
        items.push(value);
      }
    },
    dequeue() {
      return new Promise<T>((resolve) => {
        if (items.length > 0) {
          const value = items.shift() as T;
          resolve(value);
        } else {
          resolveList.push(resolve);
        }
      });
    },
  };
};
