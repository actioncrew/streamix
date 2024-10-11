// Define the Hook interface
export interface HookOperator {
  callback: (params?: any) => void | Promise<void>;
}
