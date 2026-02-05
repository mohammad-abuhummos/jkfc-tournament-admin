import * as React from "react";

import type { Route } from "./+types/tournaments.$tournamentId.matches";
import { useAuth } from "~/auth/auth";
import {
  createTournamentMatch,
  deleteTournamentMatch,
  setTournamentMatchResult,
  subscribeToTournamentGroups,
  subscribeToTournamentMatches,
  subscribeToTournamentTeams,
  updateTournamentMatch,
} from "~/features/tournaments/api";
import { useTournamentManager } from "~/features/tournaments/context";
import type { Group, Team, TournamentMatch } from "~/features/tournaments/types";

export function meta({ }: Route.MetaArgs) {
  return [{ title: "Matches | JKFC Admin" }];
}

type ModalProps = {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  children: React.ReactNode;
};

function Modal({ open, title, description, onClose, children }: ModalProps) {
  React.useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
        aria-label="Close modal"
      />
      <div
        role="dialog"
        aria-modal="true"
        className="relative w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-black/5"
      >
        <div className="flex items-start justify-between gap-3 border-b border-gray-100 px-5 py-4">
          <div className="min-w-0">
            <div className="truncate text-lg font-semibold text-gray-900">{title}</div>
            {description ? (
              <div className="mt-1 text-sm text-gray-600">{description}</div>
            ) : null}
          </div>
          <button
            type="button"
            className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
            onClick={onClose}
            aria-label="Close"
          >
            <svg
              viewBox="0 0 24 24"
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
      </div>
    </div>
  );
}

function toDateTimeLocalValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`;
}

export default function TournamentMatches() {
  const { user } = useAuth();
  const { tournamentId } = useTournamentManager();
  const actor = user
    ? { userId: user.uid, userEmail: user.email ?? null }
    : undefined;

  const [teams, setTeams] = React.useState<Team[]>([]);
  const [groups, setGroups] = React.useState<Group[]>([]);
  const [matches, setMatches] = React.useState<TournamentMatch[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [message, setMessage] = React.useState<string | null>(null);

  const [createModalOpen, setCreateModalOpen] = React.useState(false);
  const [editModalOpen, setEditModalOpen] = React.useState(false);
  const [editingMatch, setEditingMatch] = React.useState<TournamentMatch | null>(null);

  // Create match form
  const [groupId, setGroupId] = React.useState<string>("");
  const [team1Id, setTeam1Id] = React.useState<string>("");
  const [team2Id, setTeam2Id] = React.useState<string>("");
  const [scheduledAt, setScheduledAt] = React.useState<string>("");
  const [creating, setCreating] = React.useState(false);

  // Edit match form
  const [editGroupId, setEditGroupId] = React.useState<string>("");
  const [editTeam1Id, setEditTeam1Id] = React.useState<string>("");
  const [editTeam2Id, setEditTeam2Id] = React.useState<string>("");
  const [editScheduledAt, setEditScheduledAt] = React.useState<string>("");
  const [savingEdit, setSavingEdit] = React.useState(false);
  const [deletingMatchId, setDeletingMatchId] = React.useState<string | null>(null);

  // Result editing (per match)
  const [scoreByMatch, setScoreByMatch] = React.useState<
    Record<string, { s1: string; s2: string }>
  >({});
  const [busyMatchId, setBusyMatchId] = React.useState<string | null>(null);
  const [busyAction, setBusyAction] = React.useState<"score" | "finish" | null>(
    null,
  );

  const startedMatchIdsRef = React.useRef<Set<string>>(new Set());
  React.useEffect(() => {
    startedMatchIdsRef.current = new Set();
  }, [tournamentId]);

  // Auto-start matches when scheduled time is now or past
  React.useEffect(() => {
    const now = Date.now();
    for (const m of matches) {
      if (
        m.status !== "scheduled" ||
        !m.scheduledAt ||
        m.scheduledAt.toDate().getTime() > now ||
        startedMatchIdsRef.current.has(m.id)
      )
        continue;
      startedMatchIdsRef.current.add(m.id);
      void updateTournamentMatch({
        tournamentId,
        matchId: m.id,
        groupId: m.groupId ?? null,
        team1Id: m.team1Id,
        team2Id: m.team2Id,
        scheduledAt: m.scheduledAt.toDate(),
        status: "in_progress",
        actor,
      });
    }
  }, [tournamentId, matches]);

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

  const closeCreateModal = React.useCallback(() => {
    if (creating) return;
    setCreateModalOpen(false);
  }, [creating]);

  const closeEditModal = React.useCallback(() => {
    if (savingEdit) return;
    setEditModalOpen(false);
    setEditingMatch(null);
  }, [savingEdit]);

  function openCreateModal() {
    setError(null);
    setMessage(null);
    setGroupId("");
    setTeam1Id("");
    setTeam2Id("");
    setScheduledAt("");
    setCreateModalOpen(true);
  }

  function openEditModal(match: TournamentMatch) {
    const matchScheduledAt = match.scheduledAt ? match.scheduledAt.toDate() : null;
    setError(null);
    setMessage(null);
    setEditingMatch(match);
    setEditGroupId(match.groupId ?? "");
    setEditTeam1Id(match.team1Id);
    setEditTeam2Id(match.team2Id);
    setEditScheduledAt(matchScheduledAt ? toDateTimeLocalValue(matchScheduledAt) : "");
    setEditModalOpen(true);
  }

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
        actor,
      });
      setMessage("Match created.");
      setTeam1Id("");
      setTeam2Id("");
      setScheduledAt("");
      setCreateModalOpen(false);
    } catch (err) {
      console.error("[Matches] createTournamentMatch failed", err);
      setError("Failed to create match.");
    } finally {
      setCreating(false);
    }
  }

  async function handleUpdateMatch(e: React.FormEvent) {
    e.preventDefault();
    if (!editingMatch) return;

    setError(null);
    setMessage(null);

    if (editTeam1Id && editTeam2Id && editTeam1Id === editTeam2Id) {
      setError("Team 1 and Team 2 must be different.");
      return;
    }

    setSavingEdit(true);
    try {
      // Only update metadata; score is persisted only when user clicks "Finish match"
      await updateTournamentMatch({
        tournamentId,
        matchId: editingMatch.id,
        groupId: editGroupId || null,
        team1Id: editTeam1Id,
        team2Id: editTeam2Id,
        scheduledAt: editScheduledAt ? new Date(editScheduledAt) : null,
        status: editingMatch.status,
        actor,
      });
      setMessage("Match updated.");
      setEditModalOpen(false);
      setEditingMatch(null);
    } catch (err) {
      console.error("[Matches] updateTournamentMatch failed", err);
      setError("Failed to update match.");
    } finally {
      setSavingEdit(false);
    }
  }

  async function handleDeleteMatch(match: TournamentMatch) {
    const t1 = teamById.get(match.team1Id)?.nameEn ?? match.team1Id;
    const t2 = teamById.get(match.team2Id)?.nameEn ?? match.team2Id;

    const ok = window.confirm(`Delete match "${t1} vs ${t2}"? This cannot be undone.`);
    if (!ok) return;

    setDeletingMatchId(match.id);
    setError(null);
    setMessage(null);
    try {
      await deleteTournamentMatch({
        tournamentId,
        matchId: match.id,
        actor,
      });
      setMessage("Match deleted.");
    } catch (err) {
      console.error("[Matches] deleteTournamentMatch failed", err);
      setError("Failed to delete match.");
    } finally {
      setDeletingMatchId(null);
    }
  }

  async function handleSetScore(match: TournamentMatch) {
    const score = scoreByMatch[match.id] ?? { s1: "", s2: "" };
    const s1 = Number(score.s1);
    const s2 = Number(score.s2);

    if (!Number.isFinite(s1) || !Number.isFinite(s2)) {
      setError("Please enter valid scores.");
      return;
    }

    setBusyMatchId(match.id);
    setBusyAction("score");
    setError(null);
    setMessage(null);
    try {
      await updateTournamentMatch({
        tournamentId,
        matchId: match.id,
        groupId: match.groupId ?? null,
        team1Id: match.team1Id,
        team2Id: match.team2Id,
        scheduledAt: match.scheduledAt?.toDate() ?? null,
        status: match.status,
        score1: s1,
        score2: s2,
        actor,
      });
      setMessage("Score saved. Match is still in progress.");
    } catch (err) {
      console.error("[Matches] updateTournamentMatch (score) failed", err);
      setError("Failed to save score.");
    } finally {
      setBusyMatchId(null);
      setBusyAction(null);
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
    setBusyAction("finish");
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
        actor,
      });
      setMessage("Match finished.");
    } catch (err) {
      console.error("[Matches] setTournamentMatchResult failed", err);
      setError("Failed to finish match.");
    } finally {
      setBusyMatchId(null);
      setBusyAction(null);
    }
  }

  async function handleUpdateFinishedScore(match: TournamentMatch) {
    const score = scoreByMatch[match.id] ?? {
      s1: match.score1 != null ? String(match.score1) : "",
      s2: match.score2 != null ? String(match.score2) : "",
    };
    const s1 = Number(score.s1);
    const s2 = Number(score.s2);

    if (!Number.isFinite(s1) || !Number.isFinite(s2)) {
      setError("Please enter valid scores.");
      return;
    }

    setBusyMatchId(match.id);
    setBusyAction("score");
    setError(null);
    setMessage(null);
    try {
      await updateTournamentMatch({
        tournamentId,
        matchId: match.id,
        groupId: match.groupId ?? null,
        team1Id: match.team1Id,
        team2Id: match.team2Id,
        scheduledAt: match.scheduledAt?.toDate() ?? null,
        status: "finished",
        score1: s1,
        score2: s2,
        actor,
      });
      setMessage("Score updated.");
    } catch (err) {
      console.error("[Matches] update finished score failed", err);
      setError("Failed to update score.");
    } finally {
      setBusyMatchId(null);
      setBusyAction(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-xl font-semibold text-gray-900">Matches</h1>
            <p className="mt-1 text-sm text-gray-600">
              Create match schedules and set results when the match is finished.
            </p>
          </div>
          <button
            type="button"
            className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
            onClick={openCreateModal}
          >
            Create match
          </button>
        </div>

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
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-gray-900">All matches</h2>
          <div className="text-sm text-gray-600">{loading ? null : `${matches.length} total`}</div>
        </div>

        {loading ? (
          <div className="mt-2 text-sm text-gray-600">Loading...</div>
        ) : matches.length === 0 ? (
          <p className="mt-2 text-sm text-gray-600">No matches yet.</p>
        ) : (
          <div className="mt-4 space-y-4">
            {matches.map((m) => {
              const team1 = teamById.get(m.team1Id);
              const team2 = teamById.get(m.team2Id);
              const group = m.groupId ? groupById.get(m.groupId) : null;
              const scheduledText = m.scheduledAt
                ? m.scheduledAt.toDate().toLocaleString()
                : "Not scheduled";
              const scores = scoreByMatch[m.id] ?? {
                s1: m.score1 != null ? String(m.score1) : "",
                s2: m.score2 != null ? String(m.score2) : "",
              };
              const isDeleting = deletingMatchId === m.id;
              const isSavingResult = busyMatchId === m.id;
              const disableActions = isDeleting || isSavingResult;
              const isLive =
                m.status === "in_progress" ||
                (m.status === "scheduled" &&
                  m.scheduledAt &&
                  m.scheduledAt.toDate().getTime() <= Date.now());
              const statusPillClass =
                m.status === "finished"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : isLive
                    ? "border-red-200 bg-red-50 text-red-700"
                    : "border-amber-200 bg-amber-50 text-amber-700";

              return (
                <div
                  key={m.id}
                  className="rounded-2xl border border-gray-200 bg-linear-to-br from-white to-gray-50 p-5 shadow-sm transition-shadow hover:shadow-md"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="truncate text-base font-semibold text-gray-900">
                        {team1?.nameEn ?? m.team1Id}{" "}
                        <span className="font-medium text-gray-400">vs</span>{" "}
                        {team2?.nameEn ?? m.team2Id}
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-gray-600">
                        {group ? (
                          <span className="inline-flex items-center rounded-full border border-gray-200 bg-white px-2.5 py-1 text-xs font-medium text-gray-700">
                            {group.name}
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full border border-gray-200 bg-white px-2.5 py-1 text-xs font-medium text-gray-500">
                            No group
                          </span>
                        )}
                        <span className="text-gray-300">•</span>
                        <span>{scheduledText}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${statusPillClass}`}
                      >
                        {m.status === "finished"
                          ? "Finished"
                          : isLive
                            ? "Live"
                            : "Scheduled"}
                      </span>
                      <button
                        type="button"
                        className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"
                        onClick={() => openEditModal(m)}
                        disabled={disableActions}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-100 disabled:opacity-60"
                        onClick={() => handleDeleteMatch(m)}
                        disabled={disableActions}
                      >
                        {isDeleting ? "Deleting..." : "Delete"}
                      </button>
                    </div>
                  </div>

                  <div className="mt-5 rounded-xl border border-gray-200 bg-white p-4">
                    {m.status === "finished" ? (
                      <div className="space-y-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <div className="text-sm font-medium text-gray-700">
                              Final score
                            </div>
                            <div className="mt-1 text-sm text-gray-600">
                              {m.winnerTeamId
                                ? `Winner: ${teamById.get(m.winnerTeamId)?.nameEn ?? m.winnerTeamId}`
                                : "Draw"}
                            </div>
                          </div>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-[140px_140px_auto] items-end">
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
                              disabled={isSavingResult || isDeleting}
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
                              disabled={isSavingResult || isDeleting}
                            />
                          </label>
                          <button
                            type="button"
                            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-60"
                            disabled={isSavingResult || isDeleting}
                            onClick={() => handleUpdateFinishedScore(m)}
                          >
                            {busyMatchId === m.id && busyAction === "score"
                              ? "Saving..."
                              : "Update score"}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="grid gap-3 sm:grid-cols-[140px_140px_auto] items-end">
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
                            disabled={isSavingResult || isDeleting}
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
                            disabled={isSavingResult || isDeleting}
                          />
                        </label>

                        <div className="flex flex-wrap gap-3">
                          <button
                            type="button"
                            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 shadow-sm hover:bg-gray-50 disabled:opacity-60"
                            disabled={isSavingResult || isDeleting}
                            onClick={() => handleSetScore(m)}
                          >
                            {busyMatchId === m.id && busyAction === "score"
                              ? "Saving..."
                              : "Set score"}
                          </button>
                          <button
                            type="button"
                            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-60"
                            disabled={isSavingResult || isDeleting}
                            onClick={() => handleSetResult(m)}
                          >
                            {busyMatchId === m.id && busyAction === "finish"
                              ? "Finishing..."
                              : "Finish match"}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <Modal
        open={createModalOpen}
        title="Create match"
        description="Schedule a match between two teams."
        onClose={closeCreateModal}
      >
        {error ? (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}
        {message ? (
          <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
            {message}
          </div>
        ) : null}

        <form className="space-y-4" onSubmit={handleCreateMatch}>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block sm:col-span-2">
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

            <label className="block sm:col-span-2">
              <span className="text-sm font-medium text-gray-700">Date & time</span>
              <input
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                type="datetime-local"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
              />
            </label>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60"
              onClick={closeCreateModal}
              disabled={creating}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-60"
              disabled={creating}
            >
              {creating ? "Creating..." : "Create match"}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={editModalOpen}
        title={
          editingMatch
            ? `Edit match — ${teamById.get(editingMatch.team1Id)?.nameEn ?? editingMatch.team1Id} vs ${teamById.get(editingMatch.team2Id)?.nameEn ?? editingMatch.team2Id
            }`
            : "Edit match"
        }
        description="Update teams, group, or schedule time."
        onClose={closeEditModal}
      >
        {error ? (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}
        {message ? (
          <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
            {message}
          </div>
        ) : null}

        <form className="space-y-4" onSubmit={handleUpdateMatch}>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block sm:col-span-2">
              <span className="text-sm font-medium text-gray-700">Group</span>
              <select
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                value={editGroupId}
                onChange={(e) => setEditGroupId(e.target.value)}
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
                value={editTeam1Id}
                onChange={(e) => setEditTeam1Id(e.target.value)}
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
                value={editTeam2Id}
                onChange={(e) => setEditTeam2Id(e.target.value)}
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

            <label className="block sm:col-span-2">
              <span className="text-sm font-medium text-gray-700">Date & time</span>
              <input
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                type="datetime-local"
                value={editScheduledAt}
                onChange={(e) => setEditScheduledAt(e.target.value)}
              />
            </label>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60"
              onClick={closeEditModal}
              disabled={savingEdit}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-60"
              disabled={savingEdit}
            >
              {savingEdit ? "Saving..." : "Save changes"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}


