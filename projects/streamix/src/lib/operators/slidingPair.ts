import { scan } from "./scan";

export const slidingPair = () => {
  return scan(
    (acc, value) => {
      // For the first value, set it as the previous value
      if (!acc) return [undefined, value];
      // Otherwise, accumulate the previous value and the current value as a pair
      return [acc[1], value];
    },
    undefined
  )
};
