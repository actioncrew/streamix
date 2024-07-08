export abstract class AbstractConverter<T, R> {
  abstract convert(stream: T): R;
}
