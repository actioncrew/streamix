import { Stream } from '../abstractions';
import { recurse, RecurseOptions } from './recurse';

export const expand = <T = any>(
  project: (value: T) => Stream<T>,
  options: RecurseOptions = {}
) =>
  recurse<T>(
    () => true,
    project,
    options
  );
