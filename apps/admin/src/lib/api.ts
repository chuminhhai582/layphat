export function getServerBaseUrl(): string {
  if (typeof window === 'undefined') return 'http://localhost:7777';
  if (window.location.port === '5174') {
    return `${window.location.protocol}//${window.location.hostname}:7777`;
  }
  return window.location.origin;
}

export async function apiFetch<T>(
  path: string,
  pin: string,
  init?: RequestInit,
): Promise<T> {
  const base = getServerBaseUrl();
  const headers: Record<string, string> = {
    'x-admin-pin': pin,
    ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
  };

  const res = await fetch(`${base}${path}`, {
    ...init,
    headers: {
      ...headers,
      ...(init?.headers as Record<string, string> | undefined),
    },
  });

  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  return (await res.json()) as T;
}

