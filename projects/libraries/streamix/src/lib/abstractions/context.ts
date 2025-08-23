import { CallbackReturnType } from "./receiver";


export interface PipeContext {
  operatorStack: string[];
  phantomHandler: (value: any) => CallbackReturnType;
}
