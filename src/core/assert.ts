export function assertNever(x: never): never {
  throw new TypeError(`Unexpected value: ${String(x)}`);
}
