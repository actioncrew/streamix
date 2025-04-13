import { Subject } from "../streams";
import { Stream } from "./stream";

export type Operator = {
  handle: (value: any) => any;
  type: string;
  name?: string;
};

export const createOperator = (name: string, handleFn: (value: any) => any): Operator => {
  return {
    name,
    handle: handleFn,
    type: 'operator'
  };
};

export type StreamMapper = Omit<Operator, "handle"> & {
  output: Subject | ((input: Stream) => Stream);
  map(input: Stream, output: Subject): void;
};

export const createMapper = (
  name: string,
  output: Subject | ((input: Stream) => Stream),
  mapFn: (input: Stream, output: Subject) => void
): StreamMapper => {
  const isSubjectOutput = (out: typeof output): out is Subject =>
    typeof out !== 'function';

  return {
    name,
    type: 'operator',
    output,
    map: (input) => {
      if (isSubjectOutput(output)) {
        mapFn(input, output);
      }
    },
  };
};
