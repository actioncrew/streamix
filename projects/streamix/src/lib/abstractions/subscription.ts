export interface Subscription {
  unsubscribe(): Promise<void>;
}
