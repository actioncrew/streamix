import { Subscribable } from './subscribable';

// Define the Hook interface
export interface Hook {
  callback: (params?: any) => void | Promise<void>;
  init: (stream: Subscribable) => void;
}
