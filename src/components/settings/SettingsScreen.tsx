import { ArrowLeft } from "lucide-react";
import { ApiKeyField } from "./ApiKeyField";
import { ApiKeyHelp } from "./ApiKeyHelp";
import { QuotaStatus } from "./QuotaStatus";

export function SettingsScreen({ onBack }: { onBack: () => void }) {
  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-2 border-b border-graphite px-4 py-3">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back to results"
          className="rounded-sm p-1 text-paper-muted hover:text-paper"
        >
          <ArrowLeft size={16} />
        </button>
        <p className="font-medium">Settings</p>
      </header>
      <div className="flex-1 overflow-y-auto p-4">
        <ApiKeyField />
        <ApiKeyHelp />
        <QuotaStatus />
      </div>
    </div>
  );
}
