export interface Subscription {
  (): any;
  unsubscribed: boolean;
  started?: Promise<void>;
  completed?: Promise<void>;
  unsubscribe(): void;
}
