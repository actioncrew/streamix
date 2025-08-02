import { Stream } from '../abstractions';
import { recurse, RecurseOptions } from './recurse';

/**
 * Recursively expands each emitted value by applying the project function,
 * which returns a stream whose values are recursively expanded as well.
 */
export const expand = <T = any>(
  project: (value: T) => Stream<T>,
  options: RecurseOptions = {}
) =>
  recurse<T>(
    () => true,
    project,
    options
  );
