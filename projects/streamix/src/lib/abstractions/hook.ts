// Define the Hook interface
export interface Hook {
  callback: (params?: any) => void | Promise<void>;
}
