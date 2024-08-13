import { Stream } from './stream';

// Define the Hook interface
export interface Hook {
  callback: (params?: any) => void | Promise<void>;
  init: (stream: Stream) => void;
}
