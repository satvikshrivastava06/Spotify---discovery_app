import { useEffect, useState } from "react";
import { apiUsageRepository } from "../services";

export interface QuotaState {
  used: number;
  limit: number;
}

export function useQuotaStatus(): QuotaState | null {
  const [quota, setQuota] = useState<QuotaState | null>(null);

  useEffect(() => {
    let cancelled = false;
    apiUsageRepository.getUsage("youtube").then((result) => {
      if (cancelled) return;
      if (result.ok) setQuota(result.data);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return quota;
}
