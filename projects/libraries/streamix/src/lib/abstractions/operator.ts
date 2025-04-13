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
}

export const createMapper = (name: string, output: Subject | ((input: Stream) => Stream), mapFn: (input: Stream, output: Subject) => void): StreamMapper => {
  return {
    name,
    output,
    map: (input: Stream, output: Subject | ((input: Stream) => Stream) => output instanceof Function ? () => {} : mapFn(input, output),
    type: 'operator'
  };
};
