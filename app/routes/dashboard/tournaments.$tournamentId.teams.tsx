import * as React from "react";

import type { Route } from "./+types/tournaments.$tournamentId.teams";
import { useAuth } from "~/auth/auth";
import {
  createTournamentTeam,
  deleteTournamentTeam,
  DEFAULT_TEAM_LOGO_URL,
  subscribeToTournamentTeams,
  updateTournamentTeam,
} from "~/features/tournaments/api";
import { useTournamentManager } from "~/features/tournaments/context";
import type { Team } from "~/features/tournaments/types";

export function meta({ }: Route.MetaArgs) {
  return [{ title: "Teams | JKFC Admin" }];
}

function Spinner({
  size = 16,
  className = "",
  label = "Loading...",
}: {
  size?: number;
  className?: string;
  label?: string;
}) {
  return (
    <div
      className={`animate-spin rounded-full border-2 border-gray-300 border-t-gray-900 ${className}`}
      style={{ width: size, height: size }}
      aria-label={label}
    />
  );
}

function TeamLogo({ src, alt, busy }: { src: string; alt: string; busy?: boolean }) {
  const [loaded, setLoaded] = React.useState(false);

  React.useEffect(() => {
    setLoaded(false);
  }, [src]);

  return (
    <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-gray-200 bg-linear-to-br from-gray-50 to-gray-100 shadow-sm ring-2 ring-white">
      {!loaded ? (
        <div className="absolute inset-0 animate-pulse bg-linear-to-br from-gray-100 to-gray-200" />
      ) : null}
      <img
        src={src}
        alt={alt}
        className="relative h-full w-full object-cover"
        onLoad={() => setLoaded(true)}
        onError={() => setLoaded(true)}
      />
      {busy ? (
        <div className="absolute inset-0 flex items-center justify-center bg-white/70 backdrop-blur-sm">
          <Spinner size={20} />
        </div>
      ) : null}
    </div>
  );
}

function Modal({
  open,
  title,
  description,
  onClose,
  closeDisabled,
  children,
  footer,
}: {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  closeDisabled?: boolean;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  React.useEffect(() => {
    if (!open) return;

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && !closeDisabled) onClose();
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose, closeDisabled]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center">
      <div
        className="absolute inset-0 bg-black/40"
        onClick={() => {
          if (!closeDisabled) onClose();
        }}
      />

      <div
        role="dialog"
        aria-modal="true"
        className="relative w-full max-w-xl overflow-hidden rounded-2xl bg-white shadow-xl"
      >
        <div className="flex items-start justify-between gap-4 border-b border-gray-200 p-5">
          <div className="min-w-0">
            <div className="truncate text-base font-semibold text-gray-900">{title}</div>
            {description ? (
              <div className="mt-1 text-sm text-gray-600">{description}</div>
            ) : null}
          </div>
          <button
            type="button"
            className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"
            onClick={onClose}
            disabled={closeDisabled}
          >
            Close
          </button>
        </div>

        <div className="p-5">{children}</div>

        {footer ? (
          <div className="border-t border-gray-200 bg-gray-50 p-5">{footer}</div>
        ) : null}
      </div>
    </div>
  );
}

export default function TournamentTeams() {
  const { user } = useAuth();
  const { tournamentId } = useTournamentManager();
  const actor = user
    ? { userId: user.uid, userEmail: user.email ?? null }
    : undefined;

  const [teams, setTeams] = React.useState<Team[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [pageError, setPageError] = React.useState<string | null>(null);
  const [actionError, setActionError] = React.useState<string | null>(null);
  const [message, setMessage] = React.useState<string | null>(null);

  const [nameEn, setNameEn] = React.useState("");
  const [nameAr, setNameAr] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [logoFile, setLogoFile] = React.useState<File | null>(null);
  const [logoPreviewUrl, setLogoPreviewUrl] = React.useState<string | null>(null);

  const [modalOpen, setModalOpen] = React.useState(false);
  const [editingTeam, setEditingTeam] = React.useState<Team | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  const [teamToDelete, setTeamToDelete] = React.useState<Team | null>(null);
  const [deleting, setDeleting] = React.useState(false);
  const [busyTeamId, setBusyTeamId] = React.useState<string | null>(null);

  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  React.useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    setLoading(true);
    setPageError(null);

    void (async () => {
      try {
        unsubscribe = await subscribeToTournamentTeams(
          tournamentId,
          (items) => {
            setTeams(items);
            setLoading(false);
          },
          (err) => {
            console.error("[Teams] subscribeToTournamentTeams failed", err);
            setPageError("Failed to load teams.");
            setLoading(false);
          },
        );
      } catch (err) {
        console.error("[Teams] subscribeToTournamentTeams failed", err);
        setPageError("Failed to load teams.");
        setLoading(false);
      }
    })();

    return () => unsubscribe?.();
  }, [tournamentId]);

  React.useEffect(() => {
    if (!logoFile) {
      setLogoPreviewUrl(null);
      return;
    }

    const url = URL.createObjectURL(logoFile);
    setLogoPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [logoFile]);

  function openCreateModal() {
    setActionError(null);
    setMessage(null);
    setEditingTeam(null);
    setNameEn("");
    setNameAr("");
    setDescription("");
    setLogoFile(null);
    setModalOpen(true);
  }

  function openEditModal(team: Team) {
    setActionError(null);
    setMessage(null);
    setEditingTeam(team);
    setNameEn(team.nameEn ?? "");
    setNameAr(team.nameAr ?? "");
    setDescription(team.description ?? "");
    setLogoFile(null);
    setModalOpen(true);
  }

  function closeTeamModal() {
    if (submitting) return;
    setModalOpen(false);
    setEditingTeam(null);
    setLogoFile(null);
  }

  async function handleSubmitTeam(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setActionError(null);
    setMessage(null);

    try {
      if (editingTeam) {
        setBusyTeamId(editingTeam.id);
        await updateTournamentTeam({
          tournamentId,
          teamId: editingTeam.id,
          nameEn: nameEn.trim(),
          nameAr: nameAr.trim(),
          description: description.trim(),
          logoFile,
          previousLogoPath: editingTeam.logoPath ?? null,
          actor,
        });
        setMessage("Team updated.");
      } else {
        await createTournamentTeam({
          tournamentId,
          nameEn: nameEn.trim(),
          nameAr: nameAr.trim(),
          description: description.trim(),
          logoFile,
          actor,
        });
        setMessage("Team created.");
      }

      setModalOpen(false);
      setEditingTeam(null);
      setNameEn("");
      setNameAr("");
      setDescription("");
      setLogoFile(null);
      setLogoPreviewUrl(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (err) {
      console.error("[Teams] team action failed", err);
      setActionError(editingTeam ? "Failed to update team." : "Failed to create team.");
    } finally {
      setSubmitting(false);
      setBusyTeamId(null);
    }
  }

  async function handleDeleteTeam() {
    if (!teamToDelete) return;
    setDeleting(true);
    setBusyTeamId(teamToDelete.id);
    setActionError(null);
    setMessage(null);

    try {
      await deleteTournamentTeam({
        tournamentId,
        teamId: teamToDelete.id,
        logoPath: teamToDelete.logoPath ?? null,
        actor,
      });
      setMessage("Team deleted.");
      setTeamToDelete(null);
    } catch (err) {
      console.error("[Teams] deleteTournamentTeam failed", err);
      setActionError("Failed to delete team.");
    } finally {
      setDeleting(false);
      setBusyTeamId(null);
    }
  }

  const isUploadingLogo = submitting && Boolean(logoFile);
  const modalLogoSrc =
    logoPreviewUrl || editingTeam?.logoUrl || DEFAULT_TEAM_LOGO_URL;

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-gray-200 bg-white p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Teams</h1>
            <p className="mt-1 text-sm text-gray-600">
              Create a new team or use existing ones when building groups and matches.
            </p>
          </div>

          <button
            type="button"
            className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2 font-medium text-white shadow-sm hover:bg-blue-700 disabled:opacity-60"
            onClick={openCreateModal}
            disabled={submitting || deleting}
          >
            Create team
          </button>
        </div>

        {pageError ? (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {pageError}
          </div>
        ) : null}

        {actionError ? (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {actionError}
          </div>
        ) : null}
        {message ? (
          <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
            {message}
          </div>
        ) : null}
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-6">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-gray-900">Existing teams</h2>
          <div className="text-sm text-gray-600">{teams.length} team(s)</div>
        </div>

        {loading ? (
          <div className="mt-2 text-sm text-gray-600">Loading teams...</div>
        ) : teams.length === 0 ? (
          <p className="mt-2 text-sm text-gray-600">No teams yet.</p>
        ) : (
          <div className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {teams.map((t) => {
              const busy = busyTeamId === t.id;
              return (
                <div
                  key={t.id}
                  className="group relative overflow-hidden rounded-2xl border border-gray-100 bg-linear-to-br from-white via-white to-slate-50 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-blue-100/50"
                >
                  {/* Top accent bar */}
                  <div className="absolute inset-x-0 top-0 h-1 bg-linear-to-r from-blue-500 via-indigo-500 to-violet-500 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

                  {/* Decorative corner glow */}
                  <div className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-linear-to-br from-blue-400/10 to-violet-400/10 blur-2xl transition-transform duration-500 group-hover:scale-150" />

                  <div className="relative p-5">
                    {/* Header with logo and names */}
                    <div className="flex items-center gap-4">
                      <div className="relative">
                        <div className="absolute -inset-1 rounded-2xl bg-linear-to-br from-blue-400/20 to-violet-400/20 opacity-0 blur transition-opacity duration-300 group-hover:opacity-100" />
                        <TeamLogo
                          src={t.logoUrl || DEFAULT_TEAM_LOGO_URL}
                          alt={t.nameEn}
                          busy={busy}
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="truncate text-lg font-bold text-gray-900 transition-colors duration-200 group-hover:text-blue-700">
                          {t.nameEn}
                        </h3>
                        <p className="truncate text-sm font-medium text-gray-500" dir="rtl">
                          {t.nameAr}
                        </p>
                      </div>
                    </div>

                    {/* Description */}
                    <div className="mt-4 min-h-12">
                      {t.description ? (
                        <p className="line-clamp-2 text-sm leading-relaxed text-gray-600">
                          {t.description}
                        </p>
                      ) : (
                        <p className="text-sm italic text-gray-400">No description provided</p>
                      )}
                    </div>

                    {/* Divider */}
                    <div className="mt-4 border-t border-gray-100" />

                    {/* Action buttons */}
                    <div className="mt-4 flex items-center justify-end gap-2">
                      <button
                        type="button"
                        className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 shadow-sm transition-all duration-200 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 hover:shadow disabled:opacity-50"
                        onClick={() => openEditModal(t)}
                        disabled={submitting || deleting}
                      >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                        Edit
                      </button>
                      <button
                        type="button"
                        className="inline-flex items-center gap-1.5 rounded-lg border border-red-100 bg-red-50/50 px-3 py-1.5 text-sm font-medium text-red-600 transition-all duration-200 hover:border-red-200 hover:bg-red-100 hover:text-red-700 hover:shadow disabled:opacity-50"
                        onClick={() => setTeamToDelete(t)}
                        disabled={submitting || deleting}
                      >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <Modal
        open={modalOpen}
        title={editingTeam ? "Edit team" : "Create team"}
        description={
          editingTeam ? "Update team details and logo." : "Add a new team to this tournament."
        }
        onClose={closeTeamModal}
        closeDisabled={submitting}
        footer={
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
            <button
              type="button"
              className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50 disabled:opacity-60"
              onClick={closeTeamModal}
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              form="team-form"
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
              disabled={submitting}
            >
              {isUploadingLogo ? <Spinner size={16} className="border-white/40 border-t-white" /> : null}
              {submitting
                ? isUploadingLogo
                  ? "Uploading..."
                  : "Saving..."
                : editingTeam
                  ? "Save changes"
                  : "Create team"}
            </button>
          </div>
        }
      >
        {actionError ? (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {actionError}
          </div>
        ) : null}

        <form id="team-form" className="space-y-4" onSubmit={handleSubmitTeam}>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="text-sm font-medium text-gray-700">Team name (EN)</span>
              <input
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
                value={nameEn}
                onChange={(e) => setNameEn(e.target.value)}
                required
                disabled={submitting}
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-gray-700">Team name (AR)</span>
              <input
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
                value={nameAr}
                onChange={(e) => setNameAr(e.target.value)}
                required
                disabled={submitting}
              />
            </label>
          </div>

          <label className="block">
            <span className="text-sm font-medium text-gray-700">Description</span>
            <textarea
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              disabled={submitting}
            />
          </label>

          <div className="grid gap-4 sm:grid-cols-[auto_1fr] items-start">
            <div className="relative h-16 w-16 overflow-hidden rounded-2xl border border-gray-200 bg-gray-50">
              <img
                src={modalLogoSrc}
                alt={editingTeam ? editingTeam.nameEn : nameEn || "Team logo"}
                className="h-full w-full object-cover"
              />
              {isUploadingLogo ? (
                <div className="absolute inset-0 flex items-center justify-center bg-white/60">
                  <Spinner size={20} />
                </div>
              ) : null}
            </div>

            <label className="block">
              <span className="text-sm font-medium text-gray-700">Logo</span>
              <input
                ref={fileInputRef}
                className="mt-1 block w-full text-sm text-gray-700"
                type="file"
                accept="image/*"
                onChange={(e) => setLogoFile(e.target.files?.[0] ?? null)}
                disabled={submitting}
              />
              <p className="mt-1 text-xs text-gray-500">
                If you don’t upload a logo, the default logo will be used.
              </p>
            </label>
          </div>
        </form>
      </Modal>

      <Modal
        open={Boolean(teamToDelete)}
        title="Delete team?"
        description={
          teamToDelete
            ? `This will permanently delete “${teamToDelete.nameEn}”.`
            : undefined
        }
        onClose={() => {
          if (deleting) return;
          setTeamToDelete(null);
        }}
        closeDisabled={deleting}
        footer={
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
            <button
              type="button"
              className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50 disabled:opacity-60"
              onClick={() => setTeamToDelete(null)}
              disabled={deleting}
            >
              Cancel
            </button>
            <button
              type="button"
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60"
              onClick={handleDeleteTeam}
              disabled={deleting}
            >
              {deleting ? (
                <Spinner size={16} className="border-white/40 border-t-white" />
              ) : null}
              {deleting ? "Deleting..." : "Delete"}
            </button>
          </div>
        }
      >
        {actionError ? (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {actionError}
          </div>
        ) : (
          <p className="text-sm text-gray-700">
            This cannot be undone. If this team is already used in groups or matches, you may
            need to update those records too.
          </p>
        )}
      </Modal>
    </div>
  );
}


