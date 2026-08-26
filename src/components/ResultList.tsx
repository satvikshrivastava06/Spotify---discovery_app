import type { TrackResult } from "../db/trackRepository";
import { ResultCard } from "./ResultCard";

export interface ResultListProps {
  results: TrackResult[];
  onDismiss: (youtubeVideoId: string) => void;
}

export function ResultList({ results, onDismiss }: ResultListProps) {
  return (
    <ul className="space-y-3">
      {results.map((result) => (
        <li key={result.youtubeVideoId}>
          <ResultCard result={result} onDismiss={onDismiss} />
        </li>
      ))}
    </ul>
  );
}
