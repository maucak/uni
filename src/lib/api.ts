export class ApiError extends Error {
  status: number;
  code: string;
  constructor(status: number, message: string, code: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}
export async function api<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch(`/api/v1${path}`, {
    ...options,
    credentials: "same-origin",
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers,
    },
  });
  if (!response.ok) {
    const data = await response
      .json()
      .catch(() => ({ message: "Sunucuya ulaşılamadı." }));
    throw new ApiError(
      response.status,
      data.fieldErrors?.join(" · ") || data.message || "İşlem başarısız.",
      data.code,
    );
  }
  return response.status === 204 ? (undefined as T) : response.json();
}
export const json = (method: string, body: unknown): RequestInit => ({
  method,
  body: JSON.stringify(body),
});
