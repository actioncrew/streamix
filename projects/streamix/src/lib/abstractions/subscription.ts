export interface Subscription {
  (): any;
  subscribed: number;
  unsubscribed: number | undefined;
  started?: Promise<void>;
  completed?: Promise<void>;
  unsubscribe(): void;
}
