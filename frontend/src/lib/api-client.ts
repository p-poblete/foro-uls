/**
 * Cliente HTTP simple para la API REST del backend.
 * Lee VITE_API_BASE_URL y añade automáticamente el JWT desde localStorage.
 *
 * El frontend actualmente usa datos mock (src/lib/mock-data.ts) en los
 * endpoints de src/api/*. Cuando el backend esté listo, reemplaza el cuerpo
 * de cada función ahí por llamadas a `apiFetch()`.
 */
import { API_BASE_URL, STORAGE_KEYS } from "@/constants";

export class ApiError extends Error {
  code: string;
  status: number;
  details?: { field: string; reason: string };
  constructor(status: number, code: string, message: string, details?: any) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(STORAGE_KEYS.token);
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = getToken();
  const headers = new Headers(options.headers);
  if (!headers.has("Content-Type") && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const res = await fetch(`${API_BASE_URL}/api${path}`, { ...options, headers });

  if (res.status === 204) return undefined as T;

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    if (res.status === 401 && typeof window !== "undefined") {
      localStorage.removeItem(STORAGE_KEYS.token);
      localStorage.removeItem(STORAGE_KEYS.user);
    }
    const err = data?.error ?? {};
    throw new ApiError(res.status, err.code ?? "UNKNOWN", err.message ?? res.statusText, err.details);
  }

  return data as T;
}
