/**
 * SocietyOS API client — thin typed wrapper over fetch.
 * All apps (admin/resident/guard) share this; auth state is caller-managed.
 */

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
  }
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export class ApiClient {
  private accessToken: string | null = null;
  private refreshToken: string | null = null;

  constructor(
    private readonly baseUrl: string,
    private readonly onTokenRefresh?: (tokens: TokenPair) => void,
    private readonly onSessionExpired?: () => void,
  ) {}

  setTokens(tokens: Partial<TokenPair>): void {
    this.accessToken = tokens.accessToken ?? null;
    this.refreshToken = tokens.refreshToken ?? null;
  }

  clearTokens(): void {
    this.accessToken = null;
    this.refreshToken = null;
  }

  async request<T>(method: string, path: string, body?: unknown, retry = true): Promise<T> {
    const headers: Record<string, string> = {};
    if (body !== undefined) headers["Content-Type"] = "application/json";
    if (this.accessToken) headers.Authorization = `Bearer ${this.accessToken}`;

    let res: Response;
    try {
      res = await fetch(`${this.baseUrl}${path}`, {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
    } catch {
      // Offline — surface as network error so PWA can queue for later sync.
      throw new ApiError(0, "NETWORK_ERROR", "Network unreachable");
    }

    if (res.status === 401 && retry && this.refreshToken) {
      const refreshed = await this.tryRefresh();
      if (refreshed) return this.request<T>(method, path, body, false);
    }
    if (!res.ok) {
      let code = "HTTP_ERROR";
      let message = `Request failed (${res.status})`;
      let details: unknown;
      try {
        const envelope = (await res.json()) as { error?: { code?: string; message?: string; details?: unknown } };
        code = envelope.error?.code ?? code;
        message = envelope.error?.message ?? message;
        details = envelope.error?.details;
      } catch { /* non-JSON body */ }
      throw new ApiError(res.status, code, message, details);
    }
    return (await res.json()) as T;
  }

  get<T>(path: string): Promise<T> { return this.request("GET", path); }
  post<T>(path: string, body?: unknown): Promise<T> { return this.request("POST", path, body); }
  patch<T>(path: string, body?: unknown): Promise<T> { return this.request("PATCH", path, body); }
  delete<T>(path: string): Promise<T> { return this.request("DELETE", path); }

  private async tryRefresh(): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken: this.refreshToken }),
      });
      if (!res.ok) {
        this.clearTokens();
        this.onSessionExpired?.();
        return false;
      }
      const tokens = (await res.json()) as TokenPair;
      this.setTokens(tokens);
      this.onTokenRefresh?.(tokens);
      return true;
    } catch {
      return false;
    }
  }

  /** Authenticated SSE stream URL (token passed via header by EventSource wrapper). */
  get streamUrl(): string { return `${this.baseUrl}/realtime/stream`; }
  get authHeader(): Record<string, string> {
    return this.accessToken ? { Authorization: `Bearer ${this.accessToken}` } : {};
  }
}
