export abstract class Converter<T, R> {
  abstract convert(stream: T): R;
}
