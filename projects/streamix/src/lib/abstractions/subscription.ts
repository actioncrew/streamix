export interface Subscription {
  (): any;
  started?: Promise<void>;
  completed?: Promise<void>;
  unsubscribe(): void;
}
