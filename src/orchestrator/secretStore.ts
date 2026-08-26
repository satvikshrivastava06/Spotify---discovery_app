/**
 * Thin abstraction over secure key-value storage, mirroring the
 * SqlExecutor (Module 2) and HttpClient (Module 3) pattern. Production
 * uses StrongholdSecretStore; tests use FakeSecretStore (in-memory).
 *
 * Note on this module's testing story: unlike SqlExecutor, where an
 * alternative real-SQLite implementation could stand in for tests,
 * there's no equivalent "real but Tauri-free" way to exercise Stronghold
 * — it's a Rust library reachable only through the Tauri IPC bridge, the
 * same fundamental limit Module 1's OS media bridge hit. So this
 * interface exists specifically to let everything built *on top of*
 * secret storage (ApiKeyManager, StrongholdCredentialsProvider) be fully
 * unit tested, while StrongholdSecretStore itself is reviewed rather than
 * tested here — see the module notes for what to manually verify.
 */
export interface SecretStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
}
