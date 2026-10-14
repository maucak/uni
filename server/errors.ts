export function fail(status: number, code: string, message: string): never {
  throw Object.assign(new Error(message), { status, code });
}
