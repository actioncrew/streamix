export interface Subscription {
  (): any;
  unsubscribe(): Promise<void>;
}
