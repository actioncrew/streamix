import { Stream } from '../abstractions';
import { loop } from './loop';

export function range(start: number, end: number, step: number = 1): Stream<number> {
  // Create the custom run function for the RangeStream
  const stream = loop(start, current => current < end, current => current + step);

  stream.name = 'range';
  return stream;
}
