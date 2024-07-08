
export interface Emission {
  value?: any;
  isCancelled?: boolean;
  isPending?: boolean;
  isPhantom?: boolean;
  isFailed?: boolean;
  isComplete?: boolean;
  error?: any;
}
