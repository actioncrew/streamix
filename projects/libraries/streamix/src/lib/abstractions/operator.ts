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
  map(stream: Stream<any>): Stream<any>;
}

export const createMapper = (name: string, mapFn: (stream: Stream) => Stream): StreamMapper => {
  return {
    name,
    map: mapFn,
    type: 'operator'
  };
};
