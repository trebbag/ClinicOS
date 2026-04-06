export type GraphConfig = {
  tenantId: string;
  clientId: string;
  clientSecret: string;
};

export class GraphClient {
  private accessToken: string | null = null;
  private accessTokenExpiresAt = 0;

  constructor(private readonly config: GraphConfig) {}

  async request<T>(path: string, init?: RequestInit): Promise<T> {
    const token = await this.getAccessToken();
    const response = await fetch(`https://graph.microsoft.com/v1.0${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        ...(init?.headers ?? {})
      }
    });

    if (!response.ok) {
      throw new Error(`Graph request failed (${response.status}): ${await response.text()}`);
    }

    if (response.status === 204) {
      return undefined as T;
    }

    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("application/json")) {
      return (await response.text()) as T;
    }

    return (await response.json()) as T;
  }

  private async getAccessToken(): Promise<string> {
    if (this.accessToken && Date.now() < this.accessTokenExpiresAt) {
      return this.accessToken;
    }

    const tokenUrl = `https://login.microsoftonline.com/${this.config.tenantId}/oauth2/v2.0/token`;
    const response = await fetch(tokenUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: new URLSearchParams({
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        grant_type: "client_credentials",
        scope: "https://graph.microsoft.com/.default"
      })
    });

    if (!response.ok) {
      throw new Error(`Failed to acquire Graph token (${response.status}): ${await response.text()}`);
    }

    const payload = await response.json() as {
      access_token: string;
      expires_in: number;
    };

    this.accessToken = payload.access_token;
    this.accessTokenExpiresAt = Date.now() + Math.max(0, payload.expires_in - 60) * 1000;
    return this.accessToken;
  }
}
