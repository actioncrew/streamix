import { recurse, RecurseOptions } from './recurse';

export const expand = <T = any>(
  project: (value: T) => AsyncIterable<T>,
  options: RecurseOptions = {}
) =>
  recurse<T>(
    () => true,
    project,
    options
  );
