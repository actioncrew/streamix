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
  output: Subject | Function;
  map(input: Stream, output: Subject | Stream): void;
}

export const createMapper = (name: string, output: Subject | Function, mapFn: (input: Stream, output: Subject | Function) => void): StreamMapper => {
  return {
    name,
    output,
    map: (input: Stream, output: Subject | Function) => output instanceof Function ? output(input): mapFn(input, output),
    type: 'operator'
  };
};
