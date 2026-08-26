// Test-only — never imported from production code.
import type { SecretStore } from "./secretStore";

export class FakeSecretStore implements SecretStore {
  private data = new Map<string, string>();

  async get(key: string): Promise<string | null> {
    return this.data.get(key) ?? null;
  }

  async set(key: string, value: string): Promise<void> {
    this.data.set(key, value);
  }
}
