import { AsyncOperator, Emission } from "../abstractions";


export function debounce<T>(duration: number): AsyncOperator {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  let lastEmission: Emission<T> | null = null;

  const operator: AsyncOperator = {
    type: 'debounce',
    handle: async (emission: Emission<T>) => {
      return new Promise<Emission<T>>((resolve) => {
        if (timeoutId) {
          clearTimeout(timeoutId);
        }

        lastEmission = emission;

        timeoutId = setTimeout(() => {
          resolve(lastEmission!);
        }, duration);
      });
    }
  };

  return operator;
}
