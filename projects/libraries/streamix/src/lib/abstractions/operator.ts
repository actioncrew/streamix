
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
