import * as React from "react";

import type { Route } from "./+types/tournaments.$tournamentId.groups";
import {
  addTeamToGroup,
  createTournamentGroup,
  createTournamentMatchesBatch,
  removeTeamFromGroup,
  subscribeToTournamentGroups,
  subscribeToTournamentTeams,
} from "~/features/tournaments/api";
import { useTournamentManager } from "~/features/tournaments/context";
import { generateRoundRobinPairs } from "~/features/tournaments/schedule";
import type { Group, Team } from "~/features/tournaments/types";

export function meta({}: Route.MetaArgs) {
  return [{ title: "Groups | JKFC Admin" }];
}

export default function TournamentGroups() {
  const { tournamentId } = useTournamentManager();

  const [teams, setTeams] = React.useState<Team[]>([]);
  const [groups, setGroups] = React.useState<Group[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const [groupName, setGroupName] = React.useState("");
  const [groupOrder, setGroupOrder] = React.useState<number>(1);
  const [creating, setCreating] = React.useState(false);

  const [selectedTeamByGroup, setSelectedTeamByGroup] = React.useState<
    Record<string, string>
  >({});
  const [busyGroupId, setBusyGroupId] = React.useState<string | null>(null);
  const [message, setMessage] = React.useState<string | null>(null);

  React.useEffect(() => {
    let unsubTeams: (() => void) | undefined;
    let unsubGroups: (() => void) | undefined;
    setLoading(true);
    setError(null);

    void (async () => {
      try {
        unsubTeams = await subscribeToTournamentTeams(
          tournamentId,
          (items) => setTeams(items),
          (err) => {
            console.error("[Groups] subscribeToTournamentTeams failed", err);
            setError("Failed to load teams.");
          },
        );

        unsubGroups = await subscribeToTournamentGroups(
          tournamentId,
          (items) => {
            setGroups(items);
            setLoading(false);
          },
          (err) => {
            console.error("[Groups] subscribeToTournamentGroups failed", err);
            setError("Failed to load groups.");
            setLoading(false);
          },
        );
      } catch (err) {
        console.error("[Groups] subscribe failed", err);
        setError("Failed to load data.");
        setLoading(false);
      }
    })();

    return () => {
      unsubTeams?.();
      unsubGroups?.();
    };
  }, [tournamentId]);

  const teamById = React.useMemo(() => {
    const m = new Map<string, Team>();
    for (const t of teams) m.set(t.id, t);
    return m;
  }, [teams]);

  async function handleCreateGroup(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setError(null);
    setMessage(null);

    try {
      await createTournamentGroup({
        tournamentId,
        name: groupName.trim(),
        order: Number(groupOrder) || 0,
      });
      setGroupName("");
      setGroupOrder((prev) => prev + 1);
      setMessage("Group created.");
    } catch (err) {
      console.error("[Groups] createTournamentGroup failed", err);
      setError("Failed to create group.");
    } finally {
      setCreating(false);
    }
  }

  async function handleAddTeam(groupId: string) {
    const teamId = selectedTeamByGroup[groupId];
    if (!teamId) return;

    setBusyGroupId(groupId);
    setError(null);
    setMessage(null);
    try {
      await addTeamToGroup({ tournamentId, groupId, teamId });
      setSelectedTeamByGroup((prev) => ({ ...prev, [groupId]: "" }));
    } catch (err) {
      console.error("[Groups] addTeamToGroup failed", err);
      setError("Failed to add team to group.");
    } finally {
      setBusyGroupId(null);
    }
  }

  async function handleRemoveTeam(groupId: string, teamId: string) {
    setBusyGroupId(groupId);
    setError(null);
    setMessage(null);
    try {
      await removeTeamFromGroup({ tournamentId, groupId, teamId });
    } catch (err) {
      console.error("[Groups] removeTeamFromGroup failed", err);
      setError("Failed to remove team from group.");
    } finally {
      setBusyGroupId(null);
    }
  }

  async function handleGenerateSchedule(group: Group) {
    if (group.teamIds.length < 2) return;

    setBusyGroupId(group.id);
    setError(null);
    setMessage(null);

    try {
      const pairs = generateRoundRobinPairs(group.teamIds);
      await createTournamentMatchesBatch({
        tournamentId,
        groupId: group.id,
        matches: pairs.map((p) => ({
          team1Id: p.team1Id,
          team2Id: p.team2Id,
          scheduledAt: null,
        })),
      });
      setMessage(
        `Schedule generated for ${group.name}. (Don’t run twice or you’ll duplicate matches.)`,
      );
    } catch (err) {
      console.error("[Groups] createTournamentMatchesBatch failed", err);
      setError("Failed to generate schedule.");
    } finally {
      setBusyGroupId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-gray-200 bg-white p-6">
        <h1 className="text-xl font-semibold text-gray-900">Groups</h1>
        <p className="mt-1 text-sm text-gray-600">
          Create groups, then add teams to each group.
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

        <form className="mt-6 grid gap-4 sm:grid-cols-[1fr_140px_auto]" onSubmit={handleCreateGroup}>
          <label className="block">
            <span className="text-sm font-medium text-gray-700">Group name</span>
            <input
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              placeholder="Group A"
              required
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-gray-700">Order</span>
            <input
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
              type="number"
              value={groupOrder}
              onChange={(e) => setGroupOrder(Number(e.target.value))}
              min={0}
            />
          </label>

          <div className="flex items-end">
            <button
              type="submit"
              className="rounded-lg bg-blue-600 px-4 py-2 font-medium text-white disabled:opacity-60"
              disabled={creating}
            >
              {creating ? "Creating..." : "Create group"}
            </button>
          </div>
        </form>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-gray-900">Existing groups</h2>

        {loading ? (
          <div className="mt-2 text-sm text-gray-600">Loading...</div>
        ) : groups.length === 0 ? (
          <p className="mt-2 text-sm text-gray-600">No groups yet.</p>
        ) : (
          <div className="mt-4 space-y-4">
            {groups.map((g) => {
              const availableTeams = teams.filter((t) => !g.teamIds.includes(t.id));
              const selected = selectedTeamByGroup[g.id] ?? "";

              return (
                <div key={g.id} className="rounded-xl border border-gray-200 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="font-semibold text-gray-900">{g.name}</div>
                      <div className="text-sm text-gray-600">
                        {g.teamIds.length} team(s)
                      </div>
                    </div>

                    <button
                      type="button"
                      className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50 disabled:opacity-60"
                      disabled={busyGroupId === g.id || g.teamIds.length < 2}
                      onClick={() => handleGenerateSchedule(g)}
                      title="Generate round-robin matches for this group"
                    >
                      Generate schedule
                    </button>
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]">
                    <label className="block">
                      <span className="text-sm font-medium text-gray-700">
                        Add team
                      </span>
                      <select
                        className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                        value={selected}
                        onChange={(e) =>
                          setSelectedTeamByGroup((prev) => ({
                            ...prev,
                            [g.id]: e.target.value,
                          }))
                        }
                        disabled={availableTeams.length === 0 || busyGroupId === g.id}
                      >
                        <option value="">Select team...</option>
                        {availableTeams.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.nameEn}
                          </option>
                        ))}
                      </select>
                    </label>

                    <div className="flex items-end">
                      <button
                        type="button"
                        className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
                        disabled={!selected || busyGroupId === g.id}
                        onClick={() => handleAddTeam(g.id)}
                      >
                        Add
                      </button>
                    </div>
                  </div>

                  <div className="mt-4">
                    <div className="text-sm font-medium text-gray-700">Teams</div>
                    {g.teamIds.length === 0 ? (
                      <p className="mt-1 text-sm text-gray-600">
                        No teams added yet.
                      </p>
                    ) : (
                      <ul className="mt-2 space-y-2">
                        {g.teamIds.map((id) => {
                          const t = teamById.get(id);
                          return (
                            <li
                              key={id}
                              className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2"
                            >
                              <span className="text-sm text-gray-900">
                                {t?.nameEn ?? id}
                              </span>
                              <button
                                type="button"
                                className="text-sm font-medium text-red-700 hover:underline disabled:opacity-60"
                                disabled={busyGroupId === g.id}
                                onClick={() => handleRemoveTeam(g.id, id)}
                              >
                                Remove
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    )}
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


