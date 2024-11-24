export type Receiver = {
  next: (value: any) => void;
  error: (err: any) => void;
  complete: () => void;
};

export function isReceiver(): boolean {
  
}
