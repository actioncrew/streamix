export interface Subscription {
  (): any;
  unsubscribed?: number;
  started?: Promise<void>;
  completed?: Promise<void>;
  unsubscribe(): void;
}
