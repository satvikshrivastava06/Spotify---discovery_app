import { fetch } from "@tauri-apps/plugin-http";
import type { HttpClient, HttpResponse } from "./httpClient";

export class TauriHttpClient implements HttpClient {
  async get(
    url: string,
    params: Record<string, string> = {},
    headers: Record<string, string> = {},
  ): Promise<HttpResponse> {
    const query = new URLSearchParams(params).toString();
    const fullUrl = query ? `${url}?${query}` : url;
    const response = await fetch(fullUrl, { method: "GET", headers });
    return { status: response.status, json: () => response.json() };
  }

  async post(
    url: string,
    body: Record<string, string> = {},
    headers: Record<string, string> = {},
  ): Promise<HttpResponse> {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", ...headers },
      body: new URLSearchParams(body).toString(),
    });
    return { status: response.status, json: () => response.json() };
  }
}
