import * as React from "react";

import type { Route } from "./+types/tournaments.$tournamentId.matches";
import {
  createTournamentMatch,
  setTournamentMatchResult,
  subscribeToTournamentGroups,
  subscribeToTournamentMatches,
  subscribeToTournamentTeams,
} from "~/features/tournaments/api";
import { useTournamentManager } from "~/features/tournaments/context";
import type { Group, Team, TournamentMatch } from "~/features/tournaments/types";

export function meta({}: Route.MetaArgs) {
  return [{ title: "Matches | JKFC Admin" }];
}

export default function TournamentMatches() {
  const { tournamentId } = useTournamentManager();

  const [teams, setTeams] = React.useState<Team[]>([]);
  const [groups, setGroups] = React.useState<Group[]>([]);
  const [matches, setMatches] = React.useState<TournamentMatch[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [message, setMessage] = React.useState<string | null>(null);

  // Create match form
  const [groupId, setGroupId] = React.useState<string>("");
  const [team1Id, setTeam1Id] = React.useState<string>("");
  const [team2Id, setTeam2Id] = React.useState<string>("");
  const [scheduledAt, setScheduledAt] = React.useState<string>("");
  const [creating, setCreating] = React.useState(false);

  // Result editing (per match)
  const [scoreByMatch, setScoreByMatch] = React.useState<
    Record<string, { s1: string; s2: string }>
  >({});
  const [busyMatchId, setBusyMatchId] = React.useState<string | null>(null);

  React.useEffect(() => {
    let unsubTeams: (() => void) | undefined;
    let unsubGroups: (() => void) | undefined;
    let unsubMatches: (() => void) | undefined;

    setLoading(true);
    setError(null);

    void (async () => {
      try {
        unsubTeams = await subscribeToTournamentTeams(
          tournamentId,
          (items) => setTeams(items),
          (err) => {
            console.error("[Matches] subscribeToTournamentTeams failed", err);
            setError("Failed to load teams.");
          },
        );

        unsubGroups = await subscribeToTournamentGroups(
          tournamentId,
          (items) => setGroups(items),
          (err) => {
            console.error("[Matches] subscribeToTournamentGroups failed", err);
            setError("Failed to load groups.");
          },
        );

        unsubMatches = await subscribeToTournamentMatches(
          tournamentId,
          (items) => {
            setMatches(items);
            setLoading(false);
          },
          (err) => {
            console.error("[Matches] subscribeToTournamentMatches failed", err);
            setError("Failed to load matches.");
            setLoading(false);
          },
        );
      } catch (err) {
        console.error("[Matches] subscribe failed", err);
        setError("Failed to load data.");
        setLoading(false);
      }
    })();

    return () => {
      unsubTeams?.();
      unsubGroups?.();
      unsubMatches?.();
    };
  }, [tournamentId]);

  const teamById = React.useMemo(() => {
    const m = new Map<string, Team>();
    for (const t of teams) m.set(t.id, t);
    return m;
  }, [teams]);

  const groupById = React.useMemo(() => {
    const m = new Map<string, Group>();
    for (const g of groups) m.set(g.id, g);
    return m;
  }, [groups]);

  async function handleCreateMatch(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);

    if (team1Id && team2Id && team1Id === team2Id) {
      setError("Team 1 and Team 2 must be different.");
      return;
    }

    setCreating(true);
    try {
      await createTournamentMatch({
        tournamentId,
        groupId: groupId || null,
        team1Id,
        team2Id,
        scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
      });
      setMessage("Match created.");
      setTeam1Id("");
      setTeam2Id("");
      setScheduledAt("");
    } catch (err) {
      console.error("[Matches] createTournamentMatch failed", err);
      setError("Failed to create match.");
    } finally {
      setCreating(false);
    }
  }

  async function handleSetResult(match: TournamentMatch) {
    const score = scoreByMatch[match.id] ?? { s1: "", s2: "" };
    const s1 = Number(score.s1);
    const s2 = Number(score.s2);

    if (!Number.isFinite(s1) || !Number.isFinite(s2)) {
      setError("Please enter valid scores.");
      return;
    }

    setBusyMatchId(match.id);
    setError(null);
    setMessage(null);
    try {
      await setTournamentMatchResult({
        tournamentId,
        matchId: match.id,
        team1Id: match.team1Id,
        team2Id: match.team2Id,
        score1: s1,
        score2: s2,
      });
      setMessage("Result saved.");
    } catch (err) {
      console.error("[Matches] setTournamentMatchResult failed", err);
      setError("Failed to save result.");
    } finally {
      setBusyMatchId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-gray-200 bg-white p-6">
        <h1 className="text-xl font-semibold text-gray-900">Matches</h1>
        <p className="mt-1 text-sm text-gray-600">
          Create match schedules and set results when the match is finished.
        </p>

        {error ? (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}
        {message ? (
          <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
            {message}
          </div>
        ) : null}

        <form className="mt-6 space-y-4" onSubmit={handleCreateMatch}>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <label className="block">
              <span className="text-sm font-medium text-gray-700">Group</span>
              <select
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                value={groupId}
                onChange={(e) => setGroupId(e.target.value)}
              >
                <option value="">(No group)</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="text-sm font-medium text-gray-700">Team 1</span>
              <select
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                value={team1Id}
                onChange={(e) => setTeam1Id(e.target.value)}
                required
              >
                <option value="">Select...</option>
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.nameEn}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="text-sm font-medium text-gray-700">Team 2</span>
              <select
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                value={team2Id}
                onChange={(e) => setTeam2Id(e.target.value)}
                required
              >
                <option value="">Select...</option>
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.nameEn}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="text-sm font-medium text-gray-700">
                Date & time
              </span>
              <input
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                type="datetime-local"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
              />
            </label>
          </div>

          <button
            type="submit"
            className="rounded-lg bg-blue-600 px-4 py-2 font-medium text-white disabled:opacity-60"
            disabled={creating}
          >
            {creating ? "Creating..." : "Create match"}
          </button>
        </form>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-gray-900">All matches</h2>

        {loading ? (
          <div className="mt-2 text-sm text-gray-600">Loading...</div>
        ) : matches.length === 0 ? (
          <p className="mt-2 text-sm text-gray-600">No matches yet.</p>
        ) : (
          <div className="mt-4 space-y-3">
            {matches.map((m) => {
              const team1 = teamById.get(m.team1Id);
              const team2 = teamById.get(m.team2Id);
              const group = m.groupId ? groupById.get(m.groupId) : null;
              const scores = scoreByMatch[m.id] ?? {
                s1: m.score1 != null ? String(m.score1) : "",
                s2: m.score2 != null ? String(m.score2) : "",
              };

              return (
                <div
                  key={m.id}
                  className="rounded-xl border border-gray-200 p-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="font-semibold text-gray-900">
                        {team1?.nameEn ?? m.team1Id} vs {team2?.nameEn ?? m.team2Id}
                      </div>
                      <div className="text-sm text-gray-600">
                        {group ? `Group: ${group.name} • ` : ""}
                        Status: {m.status}
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-[120px_120px_auto] items-end">
                    <label className="block">
                      <span className="text-sm font-medium text-gray-700">
                        Score 1
                      </span>
                      <input
                        className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                        type="number"
                        min={0}
                        value={scores.s1}
                        onChange={(e) =>
                          setScoreByMatch((prev) => ({
                            ...prev,
                            [m.id]: { ...scores, s1: e.target.value },
                          }))
                        }
                        disabled={m.status === "finished" || busyMatchId === m.id}
                      />
                    </label>

                    <label className="block">
                      <span className="text-sm font-medium text-gray-700">
                        Score 2
                      </span>
                      <input
                        className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                        type="number"
                        min={0}
                        value={scores.s2}
                        onChange={(e) =>
                          setScoreByMatch((prev) => ({
                            ...prev,
                            [m.id]: { ...scores, s2: e.target.value },
                          }))
                        }
                        disabled={m.status === "finished" || busyMatchId === m.id}
                      />
                    </label>

                    <div className="flex gap-3">
                      <button
                        type="button"
                        className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
                        disabled={m.status === "finished" || busyMatchId === m.id}
                        onClick={() => handleSetResult(m)}
                      >
                        {busyMatchId === m.id ? "Saving..." : "Set result"}
                      </button>
                      {m.status === "finished" ? (
                        <span className="self-center text-sm text-emerald-700">
                          Done
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}


