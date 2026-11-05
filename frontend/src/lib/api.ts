"use client";
import { useAuth } from "./store";

type Envelope<T> = { success: boolean; message: string; data: T; errors: Record<string, string> | null };

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL?.replace(/\/+$/, "") ?? "";

function apiUrl(path: string): string {
  return API_BASE_URL ? `${API_BASE_URL}${path.startsWith("/") ? path : `/${path}`}` : path;
}

async function attemptRefresh(): Promise<boolean> {
  const { refresh } = useAuth.getState();
  if (!refresh) return false;

  try {
    const res = await fetch(apiUrl("/api/v1/auth/refresh"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh }),
    });

    const json = (await res.json()) as Envelope<{ user: never; access: string; refresh: string }>;
    if (!json.success) return false;

    useAuth.getState().setAuth(json.data.user, json.data.access, json.data.refresh);
    return true;
  } catch {
    return false;
  }
}

let refreshInFlight: Promise<boolean> | null = null;

function refreshOnce(): Promise<boolean> {
  if (!refreshInFlight) {
    refreshInFlight = attemptRefresh().finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
}

async function request<T>(path: string, init: RequestInit, retried: boolean, serverRetried = false): Promise<Envelope<T>> {
  const { access } = useAuth.getState();
  const headers = new Headers(init.headers);
  const isFormData = typeof FormData !== "undefined" && init.body instanceof FormData;

  if (!isFormData && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  if (access && !headers.has("Authorization")) {
    headers.set("Authorization", "Bearer " + access);
  }

  try {
    const res = await fetch(apiUrl(path), {
      ...init,
      headers,
    });

    if (res.status >= 500 && init.method === "GET" && !serverRetried) {
      await new Promise((resolve) => window.setTimeout(resolve, 250));
      return request(path, init, retried, true);
    }

    if (res.status === 401 && !retried) {
      if (await refreshOnce()) return request(path, init, true);
      useAuth.getState().clear();
    }

    if (res.status === 401 && retried) {
      useAuth.getState().clear();
    }

    try {
      return (await res.json()) as Envelope<T>;
    } catch {
      return { success: false, message: `Server returned ${res.status} without a JSON body.`, data: null as T, errors: null };
    }
  } catch {
    return {
      success: false,
      message: "Network error. Please check your connection and try again.",
      data: null as T,
      errors: null,
    };
  }
}

export const api = {
  get: <T>(path: string) => request<T>(path, { method: "GET" }, false),
  post: <T>(path: string, body?: unknown) => request<T>(path, { method: "POST", body: JSON.stringify(body ?? {}) }, false),
  patch: <T>(path: string, body?: unknown) => request<T>(path, { method: "PATCH", body: JSON.stringify(body ?? {}) }, false),
  put: <T>(path: string, body?: unknown) => request<T>(path, { method: "PUT", body: JSON.stringify(body ?? {}) }, false),
  upload: <T>(path: string, body: FormData) => request<T>(path, { method: "POST", body }, false),
  download: async (path: string) => {
    const send = () => {
      const { access } = useAuth.getState();
      return fetch(apiUrl(path), { headers: access ? { Authorization: "Bearer " + access } : {} });
    };

    let res = await send();
    if (res.status === 401 && (await refreshOnce())) res = await send();

    if (!res.ok) {
      let message = `Download failed (${res.status}).`;
      try {
        const result = await res.json() as Partial<Envelope<never>>;
        if (result.message) message = result.message;
      } catch {
        message = `Download failed (${res.status}) with an invalid response.`;
      }
      throw new Error(message);
    }

    return {
      blob: await res.blob(),
      filename: decodeURIComponent(res.headers.get("Content-Disposition")?.match(/filename\*=UTF-8''([^;]+)/i)?.[1] ?? "course-material"),
    };
  },
};
