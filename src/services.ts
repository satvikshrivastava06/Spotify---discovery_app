// Composition root: every real production dependency is constructed here,
// exactly once, and exported for the UI layer to use. Nowhere else in
// src/hooks or src/components should import a repository, client, or
// store implementation directly — this file is the single place that
// knows how Modules 2-4 wire together.
import { ApiUsageRepository } from "./db/apiUsageRepository";
import { SettingsRepository } from "./db/settingsRepository";
import { TauriSqlExecutor } from "./db/tauriExecutor";
import { TrackRepository } from "./db/trackRepository";
import { ApiKeyManager } from "./orchestrator/apiKeyManager";
import { SearchOrchestrator } from "./orchestrator/searchOrchestrator";
import { StrongholdCredentialsProvider } from "./orchestrator/strongholdCredentialsProvider";
import { StrongholdSecretStore } from "./orchestrator/strongholdSecretStore";
import { TauriHttpClient } from "./orchestrator/tauriHttpClient";

const sqlExecutor = new TauriSqlExecutor();
const httpClient = new TauriHttpClient();
const secretStore = new StrongholdSecretStore();

export const trackRepository = new TrackRepository(sqlExecutor);
export const settingsRepository = new SettingsRepository(sqlExecutor);
export const apiUsageRepository = new ApiUsageRepository(sqlExecutor);
export const apiKeyManager = new ApiKeyManager(secretStore);

const credentialsProvider = new StrongholdCredentialsProvider(apiKeyManager);

export const searchOrchestrator = new SearchOrchestrator(
  trackRepository,
  apiUsageRepository,
  credentialsProvider,
  httpClient,
);
