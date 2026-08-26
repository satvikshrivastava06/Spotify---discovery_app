// Test-only — never imported from production code.
import type { HttpClient, HttpResponse } from "./httpClient";

type Handler = (
  url: string,
  paramsOrBody: Record<string, string>,
) => HttpResponse | Promise<HttpResponse>;

export class FakeHttpClient implements HttpClient {
  private getHandlers: { match: (url: string) => boolean; handler: Handler }[] = [];
  private postHandlers: { match: (url: string) => boolean; handler: Handler }[] = [];
  public getCalls: { url: string; params: Record<string, string> }[] = [];
  public postCalls: { url: string; body: Record<string, string> }[] = [];

  onGet(urlSubstring: string, handler: Handler): void {
    this.getHandlers.push({ match: (u) => u.includes(urlSubstring), handler });
  }

  onPost(urlSubstring: string, handler: Handler): void {
    this.postHandlers.push({ match: (u) => u.includes(urlSubstring), handler });
  }

  async get(url: string, params: Record<string, string> = {}): Promise<HttpResponse> {
    this.getCalls.push({ url, params });
    const match = this.getHandlers.find((h) => h.match(url));
    if (!match) throw new Error(`FakeHttpClient: no GET handler registered for ${url}`);
    return match.handler(url, params);
  }

  async post(url: string, body: Record<string, string> = {}): Promise<HttpResponse> {
    this.postCalls.push({ url, body });
    const match = this.postHandlers.find((h) => h.match(url));
    if (!match) throw new Error(`FakeHttpClient: no POST handler registered for ${url}`);
    return match.handler(url, body);
  }
}

export function jsonResponse(status: number, data: unknown): HttpResponse {
  return { status, json: async () => data };
}
