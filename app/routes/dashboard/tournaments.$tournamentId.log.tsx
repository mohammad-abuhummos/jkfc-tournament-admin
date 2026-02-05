import * as React from "react";

import type { Route } from "./+types/tournaments.$tournamentId.log";
import {
  subscribeToAuditLog,
  type AuditLogEntry,
} from "~/features/tournaments/api";
import { useTournamentManager } from "~/features/tournaments/context";

export function meta({}: Route.MetaArgs) {
  return [{ title: "Activity Log | JKFC Admin" }];
}

function formatTimestamp(createdAt: unknown): string {
  if (createdAt == null) return "—";
  if (typeof (createdAt as { toDate?: () => Date }).toDate === "function") {
    return (createdAt as { toDate: () => Date }).toDate().toLocaleString();
  }
  if (createdAt instanceof Date) return createdAt.toLocaleString();
  return String(createdAt);
}

export default function TournamentLog() {
  const { tournamentId } = useTournamentManager();
  const [entries, setEntries] = React.useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let unsub: (() => void) | undefined;
    setLoading(true);
    setError(null);

    void (async () => {
      try {
        unsub = await subscribeToAuditLog(
          (items) => {
            setEntries(items);
            setLoading(false);
          },
          (err) => {
            console.error("[Log] subscribeToAuditLog failed", err);
            setError("Failed to load log.");
            setLoading(false);
          },
          { tournamentId, limit: 200 },
        );
      } catch (err) {
        console.error("[Log] subscribe failed", err);
        setError("Failed to load log.");
        setLoading(false);
      }
    })();

    return () => unsub?.();
  }, [tournamentId]);

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-gray-200 bg-white p-6">
        <h1 className="text-xl font-semibold text-gray-900">Activity log</h1>
        <p className="mt-1 text-sm text-gray-600">
          Who changed what in this tournament. All edits are recorded with the
          user who made them.
        </p>

        {error ? (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        {loading ? (
          <div className="mt-4 text-sm text-gray-500">Loading...</div>
        ) : entries.length === 0 ? (
          <p className="mt-4 text-sm text-gray-500">No activity yet.</p>
        ) : (
          <div className="mt-4 overflow-hidden rounded-xl border border-gray-200">
            <ul className="divide-y divide-gray-200">
              {entries.map((e) => (
                <li
                  key={e.id}
                  className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-sm"
                >
                  <span className="font-medium text-gray-900">
                    {e.userEmail ?? e.userId}
                  </span>
                  <span className="text-gray-500">
                    {e.action}
                    {e.entityType ? ` · ${e.entityType}` : ""}
                    {e.entityId ? ` (${e.entityId})` : ""}
                  </span>
                  <span className="ml-auto shrink-0 text-gray-400">
                    {formatTimestamp(e.createdAt)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
