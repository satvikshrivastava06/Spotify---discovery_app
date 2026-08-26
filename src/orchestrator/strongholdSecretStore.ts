import { appDataDir } from "@tauri-apps/api/path";
import { Client, Stronghold } from "@tauri-apps/plugin-stronghold";
import type { SecretStore } from "./secretStore";

const VAULT_FILE = "vault.hold";
const CLIENT_NAME = "spotify-discovery-app-secrets";
// Not a user-facing secret — see the Argon2 note in src-tauri/src/lib.rs.
// This exists only so Stronghold has something to derive an encryption
// key from without prompting for a master password.
const VAULT_PASSWORD = "spotify-discovery-app-v1";

export class StrongholdSecretStore implements SecretStore {
  private openPromise: Promise<{ stronghold: Stronghold; client: Client }> | null = null;

  private async connection(): Promise<{ stronghold: Stronghold; client: Client }> {
    if (!this.openPromise) {
      this.openPromise = this.open();
    }
    return this.openPromise;
  }

  private async open(): Promise<{ stronghold: Stronghold; client: Client }> {
    const vaultPath = `${await appDataDir()}/${VAULT_FILE}`;
    const stronghold = await Stronghold.load(vaultPath, VAULT_PASSWORD);
    let client: Client;
    try {
      client = await stronghold.loadClient(CLIENT_NAME);
    } catch {
      // No existing client under this name — first run.
      client = await stronghold.createClient(CLIENT_NAME);
    }
    return { stronghold, client };
  }

  async get(key: string): Promise<string | null> {
    const { client } = await this.connection();
    const store = client.getStore();
    const raw = await store.get(key);
    if (!raw) return null;
    return new TextDecoder().decode(new Uint8Array(raw));
  }

  async set(key: string, value: string): Promise<void> {
    const { stronghold, client } = await this.connection();
    const store = client.getStore();
    await store.insert(key, Array.from(new TextEncoder().encode(value)));
    await stronghold.save(); // persists the insert to the vault file on disk
  }
}
