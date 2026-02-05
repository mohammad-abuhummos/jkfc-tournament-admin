import * as React from "react";

import type { Route } from "./+types/tournaments.$tournamentId.groups";
import { useAuth } from "~/auth/auth";
import {
  addTeamToGroup,
  createTournamentGroup,
  createTournamentMatchesBatch,
  deleteTournamentGroup,
  deleteTournamentTeam,
  removeTeamFromGroup,
  subscribeToTournamentGroups,
  subscribeToTournamentTeams,
  updateTournamentGroup,
  updateTournamentTeam,
} from "~/features/tournaments/api";
import { useTournamentManager } from "~/features/tournaments/context";
import { generateRoundRobinPairs } from "~/features/tournaments/schedule";
import type { Group, Team } from "~/features/tournaments/types";

export function meta({ }: Route.MetaArgs) {
  return [{ title: "Groups | JKFC Admin" }];
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
            <div className="truncate text-lg font-semibold text-gray-900">
              {title}
            </div>
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

export default function TournamentGroups() {
  const { user } = useAuth();
  const { tournamentId } = useTournamentManager();
  const actor = user
    ? { userId: user.uid, userEmail: user.email ?? null }
    : undefined;

  const [teams, setTeams] = React.useState<Team[]>([]);
  const [groups, setGroups] = React.useState<Group[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const [createModalOpen, setCreateModalOpen] = React.useState(false);
  const [groupName, setGroupName] = React.useState("");
  const [groupOrder, setGroupOrder] = React.useState<number>(1);
  const [creating, setCreating] = React.useState(false);

  const [editGroupModalOpen, setEditGroupModalOpen] = React.useState(false);
  const [editingGroupId, setEditingGroupId] = React.useState<string | null>(null);
  const [editGroupName, setEditGroupName] = React.useState("");
  const [editGroupOrder, setEditGroupOrder] = React.useState<number>(0);
  const [savingGroup, setSavingGroup] = React.useState(false);

  const [editTeamModalOpen, setEditTeamModalOpen] = React.useState(false);
  const [editingTeamId, setEditingTeamId] = React.useState<string | null>(null);
  const [editNameEn, setEditNameEn] = React.useState("");
  const [editNameAr, setEditNameAr] = React.useState("");
  const [editDescription, setEditDescription] = React.useState("");
  const [editLogoFile, setEditLogoFile] = React.useState<File | null>(null);
  const [savingTeam, setSavingTeam] = React.useState(false);

  const [selectedTeamByGroup, setSelectedTeamByGroup] = React.useState<
    Record<string, string>
  >({});
  const [busyGroupId, setBusyGroupId] = React.useState<string | null>(null);
  const [busyTeamId, setBusyTeamId] = React.useState<string | null>(null);
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

  const groupById = React.useMemo(() => {
    const m = new Map<string, Group>();
    for (const g of groups) m.set(g.id, g);
    return m;
  }, [groups]);

  const assignedTeamIds = React.useMemo(() => {
    const s = new Set<string>();
    for (const g of groups) for (const id of g.teamIds) s.add(id);
    return s;
  }, [groups]);

  function openCreateGroupModal() {
    const nextOrder =
      groups.reduce((max, g) => Math.max(max, Number(g.order) || 0), 0) + 1;
    setGroupName("");
    setGroupOrder(nextOrder);
    setError(null);
    setMessage(null);
    setCreateModalOpen(true);
  }

  function openEditGroupModal(group: Group) {
    setEditingGroupId(group.id);
    setEditGroupName(group.name ?? "");
    setEditGroupOrder(Number(group.order) || 0);
    setError(null);
    setMessage(null);
    setEditGroupModalOpen(true);
  }

  function closeEditGroupModal() {
    if (savingGroup) return;
    setEditGroupModalOpen(false);
    setEditingGroupId(null);
  }

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
        actor,
      });
      setGroupName("");
      setGroupOrder((prev) => prev + 1);
      setMessage("Group created.");
      setCreateModalOpen(false);
    } catch (err) {
      console.error("[Groups] createTournamentGroup failed", err);
      setError("Failed to create group.");
    } finally {
      setCreating(false);
    }
  }

  async function handleUpdateGroup(e: React.FormEvent) {
    e.preventDefault();
    if (!editingGroupId) return;

    const groupId = editingGroupId;
    setSavingGroup(true);
    setBusyGroupId(groupId);
    setError(null);
    setMessage(null);
    try {
      await updateTournamentGroup({
        tournamentId,
        groupId,
        name: editGroupName.trim(),
        order: Number(editGroupOrder) || 0,
        actor,
      });
      setMessage("Group updated.");
      setEditGroupModalOpen(false);
      setEditingGroupId(null);
    } catch (err) {
      console.error("[Groups] updateTournamentGroup failed", err);
      setError("Failed to update group.");
    } finally {
      setSavingGroup(false);
      setBusyGroupId(null);
    }
  }

  async function handleDeleteGroup(groupId: string) {
    const g = groupById.get(groupId);
    const ok = window.confirm(
      `Delete group "${g?.name ?? groupId}"?\n\nThis will unassign its teams. Any existing matches linked to this group will still exist.`,
    );
    if (!ok) return;

    setBusyGroupId(groupId);
    setError(null);
    setMessage(null);
    try {
      await deleteTournamentGroup({ tournamentId, groupId, actor });
      setMessage("Group deleted.");

      if (editingGroupId === groupId) {
        setEditGroupModalOpen(false);
        setEditingGroupId(null);
      }
    } catch (err) {
      console.error("[Groups] deleteTournamentGroup failed", err);
      setError("Failed to delete group.");
    } finally {
      setBusyGroupId(null);
    }
  }

  async function handleAddTeam(groupId: string) {
    const teamId = selectedTeamByGroup[groupId];
    if (!teamId) return;
    if (assignedTeamIds.has(teamId)) {
      setError(
        "That team is already assigned to a group. Remove it from its current group first.",
      );
      setSelectedTeamByGroup((prev) => ({ ...prev, [groupId]: "" }));
      return;
    }

    setBusyGroupId(groupId);
    setError(null);
    setMessage(null);
    try {
      await addTeamToGroup({ tournamentId, groupId, teamId, actor });
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
      await removeTeamFromGroup({ tournamentId, groupId, teamId, actor });
    } catch (err) {
      console.error("[Groups] removeTeamFromGroup failed", err);
      setError("Failed to remove team from group.");
    } finally {
      setBusyGroupId(null);
    }
  }

  function openEditTeam(teamId: string) {
    const t = teamById.get(teamId);
    if (!t) {
      setError("Team not found.");
      return;
    }
    setEditingTeamId(teamId);
    setEditNameEn(t.nameEn ?? "");
    setEditNameAr(t.nameAr ?? "");
    setEditDescription(t.description ?? "");
    setEditLogoFile(null);
    setError(null);
    setMessage(null);
    setEditTeamModalOpen(true);
  }

  function closeEditTeamModal() {
    if (savingTeam) return;
    setEditTeamModalOpen(false);
    setEditingTeamId(null);
    setEditLogoFile(null);
  }

  async function handleUpdateTeam(e: React.FormEvent) {
    e.preventDefault();
    if (!editingTeamId) return;

    const teamId = editingTeamId;
    const existing = teamById.get(teamId);
    setSavingTeam(true);
    setBusyTeamId(teamId);
    setError(null);
    setMessage(null);
    try {
      await updateTournamentTeam({
        tournamentId,
        teamId,
        nameEn: editNameEn.trim(),
        nameAr: editNameAr.trim(),
        description: editDescription.trim(),
        logoFile: editLogoFile,
        previousLogoPath: existing?.logoPath ?? null,
        actor,
      });
      setMessage("Team updated.");
      setEditTeamModalOpen(false);
      setEditingTeamId(null);
      setEditLogoFile(null);
    } catch (err) {
      console.error("[Groups] updateTournamentTeam failed", err);
      setError("Failed to update team.");
    } finally {
      setSavingTeam(false);
      setBusyTeamId(null);
    }
  }

  async function handleDeleteTeam(teamId: string) {
    const t = teamById.get(teamId);
    const ok = window.confirm(
      `Delete team "${t?.nameEn ?? teamId}"?\n\nThis removes it from all groups. Any existing matches that reference it will still exist.`,
    );
    if (!ok) return;

    setBusyTeamId(teamId);
    setError(null);
    setMessage(null);
    try {
      const groupsContaining = groups.filter((g) => g.teamIds.includes(teamId));
      await Promise.all(
        groupsContaining.map((g) =>
          removeTeamFromGroup({ tournamentId, groupId: g.id, teamId, actor }).catch((err) => {
            console.warn("[Groups] removeTeamFromGroup (pre-delete) failed", err);
          }),
        ),
      );

      await deleteTournamentTeam({
        tournamentId,
        teamId,
        logoPath: t?.logoPath ?? null,
        actor,
      });
      setMessage("Team deleted.");

      if (editingTeamId === teamId) {
        setEditTeamModalOpen(false);
        setEditingTeamId(null);
      }
    } catch (err) {
      console.error("[Groups] deleteTournamentTeam failed", err);
      setError("Failed to delete team.");
    } finally {
      setBusyTeamId(null);
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
        actor,
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
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Groups</h1>
            <p className="mt-1 text-sm text-gray-600">
              Create groups, then add teams to each group. A team can only be in{" "}
              <span className="font-medium text-gray-700">one</span> group (already-assigned
              teams are hidden in the dropdown).
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 font-medium text-white shadow-sm hover:bg-blue-700 disabled:opacity-60"
              onClick={openCreateGroupModal}
              disabled={loading}
            >
              <svg
                viewBox="0 0 24 24"
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              Create group
            </button>
          </div>
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

      <div className="rounded-2xl border border-gray-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-gray-900">Existing groups</h2>

        {loading ? (
          <div className="mt-2 text-sm text-gray-600">Loading...</div>
        ) : groups.length === 0 ? (
          <p className="mt-2 text-sm text-gray-600">No groups yet.</p>
        ) : (
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            {groups.map((g) => {
              const availableTeams = teams.filter((t) => !assignedTeamIds.has(t.id));
              const selected = selectedTeamByGroup[g.id] ?? "";

              return (
                <div
                  key={g.id}
                  className="rounded-2xl border border-gray-200 bg-linear-to-b from-white to-gray-50 p-5 shadow-sm"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <div className="font-semibold text-gray-900">{g.name}</div>
                        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
                          Order {g.order}
                        </span>
                        <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
                          {g.teamIds.length} team(s)
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50 disabled:opacity-60"
                        disabled={busyGroupId === g.id || g.teamIds.length < 2}
                        onClick={() => handleGenerateSchedule(g)}
                        title="Generate round-robin matches for this group"
                      >
                        <svg
                          viewBox="0 0 24 24"
                          className="h-4 w-4"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M4 7h16M4 12h10M4 17h16"
                          />
                        </svg>
                        Generate schedule
                      </button>
                      <button
                        type="button"
                        className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50 disabled:opacity-60"
                        disabled={busyGroupId === g.id}
                        onClick={() => openEditGroupModal(g)}
                        title="Edit group"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
                        disabled={busyGroupId === g.id}
                        onClick={() => handleDeleteGroup(g.id)}
                        title="Delete group"
                      >
                        Delete
                      </button>
                    </div>
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
                        <option value="">
                          {availableTeams.length === 0 ? "No available teams" : "Select team..."}
                        </option>
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
                          const canEdit = Boolean(t);
                          const rowBusy = busyGroupId === g.id || busyTeamId === id;
                          return (
                            <li
                              key={id}
                              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white px-3 py-2 shadow-sm"
                            >
                              <div className="flex min-w-0 items-center gap-3">
                                <div className="h-9 w-9 shrink-0 overflow-hidden rounded-xl border border-gray-200 bg-gray-50">
                                  {t?.logoUrl ? (
                                    <img
                                      src={t.logoUrl}
                                      alt={t.nameEn}
                                      className="h-full w-full object-cover"
                                    />
                                  ) : null}
                                </div>
                                <div className="min-w-0">
                                  <div className="truncate text-sm font-medium text-gray-900">
                                    {t?.nameEn ?? id}
                                  </div>
                                  {t?.nameAr ? (
                                    <div className="truncate text-xs text-gray-600">
                                      {t.nameAr}
                                    </div>
                                  ) : null}
                                </div>
                              </div>

                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  className="rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-800 hover:bg-gray-50 disabled:opacity-60"
                                  disabled={!canEdit || rowBusy}
                                  onClick={() => openEditTeam(id)}
                                >
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  className="rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-800 hover:bg-gray-50 disabled:opacity-60"
                                  disabled={rowBusy}
                                  onClick={() => handleRemoveTeam(g.id, id)}
                                  title="Remove this team from the group"
                                >
                                  Remove
                                </button>
                                <button
                                  type="button"
                                  className="rounded-lg bg-red-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-60"
                                  disabled={rowBusy}
                                  onClick={() => handleDeleteTeam(id)}
                                  title="Delete this team from the tournament"
                                >
                                  Delete
                                </button>
                              </div>
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

      <Modal
        open={createModalOpen}
        title="Create group"
        description="Create a new group (e.g. Group A, Group B) and set its display order."
        onClose={() => (creating ? null : setCreateModalOpen(false))}
      >
        <form className="space-y-4" onSubmit={handleCreateGroup}>
          <label className="block">
            <span className="text-sm font-medium text-gray-700">Group name</span>
            <input
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              placeholder="Group A"
              required
              autoFocus
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

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50 disabled:opacity-60"
              onClick={() => setCreateModalOpen(false)}
              disabled={creating}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
              disabled={creating}
            >
              {creating ? "Creating..." : "Create"}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={editGroupModalOpen}
        title="Edit group"
        description="Update the group name and display order."
        onClose={closeEditGroupModal}
      >
        <form className="space-y-4" onSubmit={handleUpdateGroup}>
          <label className="block">
            <span className="text-sm font-medium text-gray-700">Group name</span>
            <input
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
              value={editGroupName}
              onChange={(e) => setEditGroupName(e.target.value)}
              placeholder="Group A"
              required
              autoFocus
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-gray-700">Order</span>
            <input
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
              type="number"
              value={editGroupOrder}
              onChange={(e) => setEditGroupOrder(Number(e.target.value))}
              min={0}
            />
          </label>

          <div className="flex items-center justify-between gap-2 pt-2">
            <button
              type="button"
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50 disabled:opacity-60"
              onClick={closeEditGroupModal}
              disabled={savingGroup}
            >
              Cancel
            </button>
            <div className="flex items-center gap-2">
              {editingGroupId ? (
                <button
                  type="button"
                  className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
                  onClick={() => handleDeleteGroup(editingGroupId)}
                  disabled={savingGroup || busyGroupId === editingGroupId}
                >
                  Delete group
                </button>
              ) : null}
              <button
                type="submit"
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                disabled={savingGroup}
              >
                {savingGroup ? "Saving..." : "Save changes"}
              </button>
            </div>
          </div>
        </form>
      </Modal>

      <Modal
        open={editTeamModalOpen}
        title="Edit team"
        description="Update team details. (Logo update is optional.)"
        onClose={closeEditTeamModal}
      >
        <form className="space-y-4" onSubmit={handleUpdateTeam}>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="text-sm font-medium text-gray-700">Team name (EN)</span>
              <input
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
                value={editNameEn}
                onChange={(e) => setEditNameEn(e.target.value)}
                required
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-gray-700">Team name (AR)</span>
              <input
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
                value={editNameAr}
                onChange={(e) => setEditNameAr(e.target.value)}
                required
              />
            </label>
          </div>

          <label className="block">
            <span className="text-sm font-medium text-gray-700">Description</span>
            <textarea
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              rows={3}
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-gray-700">Logo (optional)</span>
            <input
              className="mt-1 block w-full text-sm text-gray-700"
              type="file"
              accept="image/*"
              onChange={(e) => setEditLogoFile(e.target.files?.[0] ?? null)}
              disabled={savingTeam}
            />
          </label>

          <div className="flex items-center justify-between gap-2 pt-2">
            <button
              type="button"
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50 disabled:opacity-60"
              onClick={closeEditTeamModal}
              disabled={savingTeam}
            >
              Cancel
            </button>
            <div className="flex items-center gap-2">
              {editingTeamId ? (
                <button
                  type="button"
                  className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
                  onClick={() => handleDeleteTeam(editingTeamId)}
                  disabled={savingTeam || busyTeamId === editingTeamId}
                >
                  Delete team
                </button>
              ) : null}
              <button
                type="submit"
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                disabled={savingTeam}
              >
                {savingTeam ? "Saving..." : "Save changes"}
              </button>
            </div>
          </div>
        </form>
      </Modal>
    </div>
  );
}


