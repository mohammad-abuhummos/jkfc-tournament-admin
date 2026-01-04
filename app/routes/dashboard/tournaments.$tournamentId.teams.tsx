import * as React from "react";

import type { Route } from "./+types/tournaments.$tournamentId.teams";
import { createTournamentTeam, subscribeToTournamentTeams } from "~/features/tournaments/api";
import { useTournamentManager } from "~/features/tournaments/context";
import type { Team } from "~/features/tournaments/types";

export function meta({}: Route.MetaArgs) {
  return [{ title: "Teams | JKFC Admin" }];
}

export default function TournamentTeams() {
  const { tournamentId } = useTournamentManager();

  const [teams, setTeams] = React.useState<Team[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const [nameEn, setNameEn] = React.useState("");
  const [nameAr, setNameAr] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [logoFile, setLogoFile] = React.useState<File | null>(null);
  const [creating, setCreating] = React.useState(false);

  React.useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    setLoading(true);
    setError(null);

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
            setError("Failed to load teams.");
            setLoading(false);
          },
        );
      } catch (err) {
        console.error("[Teams] subscribeToTournamentTeams failed", err);
        setError("Failed to load teams.");
        setLoading(false);
      }
    })();

    return () => unsubscribe?.();
  }, [tournamentId]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setError(null);

    try {
      await createTournamentTeam({
        tournamentId,
        nameEn: nameEn.trim(),
        nameAr: nameAr.trim(),
        description: description.trim(),
        logoFile,
      });
      setNameEn("");
      setNameAr("");
      setDescription("");
      setLogoFile(null);
    } catch (err) {
      console.error("[Teams] createTournamentTeam failed", err);
      setError("Failed to create team.");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-gray-200 bg-white p-6">
        <h1 className="text-xl font-semibold text-gray-900">Teams</h1>
        <p className="mt-1 text-sm text-gray-600">
          Create a new team or use existing ones when building groups and matches.
        </p>

        {error ? (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        <form className="mt-6 space-y-4" onSubmit={handleCreate}>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="text-sm font-medium text-gray-700">
                Team name (EN)
              </span>
              <input
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
                value={nameEn}
                onChange={(e) => setNameEn(e.target.value)}
                required
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-gray-700">
                Team name (AR)
              </span>
              <input
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
                value={nameAr}
                onChange={(e) => setNameAr(e.target.value)}
                required
              />
            </label>
          </div>

          <label className="block">
            <span className="text-sm font-medium text-gray-700">
              Description
            </span>
            <textarea
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-gray-700">Logo</span>
            <input
              className="mt-1 block w-full text-sm text-gray-700"
              type="file"
              accept="image/*"
              onChange={(e) => setLogoFile(e.target.files?.[0] ?? null)}
            />
          </label>

          <button
            type="submit"
            className="rounded-lg bg-blue-600 px-4 py-2 font-medium text-white disabled:opacity-60"
            disabled={creating}
          >
            {creating ? "Creating..." : "Create team"}
          </button>
        </form>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-gray-900">Existing teams</h2>

        {loading ? (
          <div className="mt-2 text-sm text-gray-600">Loading teams...</div>
        ) : teams.length === 0 ? (
          <p className="mt-2 text-sm text-gray-600">No teams yet.</p>
        ) : (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {teams.map((t) => (
              <div
                key={t.id}
                className="rounded-xl border border-gray-200 bg-white p-4"
              >
                <div className="flex items-start gap-3">
                  <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg border border-gray-200 bg-gray-50">
                    {t.logoUrl ? (
                      <img
                        src={t.logoUrl}
                        alt={t.nameEn}
                        className="h-full w-full object-cover"
                      />
                    ) : null}
                  </div>
                  <div className="min-w-0">
                    <div className="font-semibold text-gray-900">{t.nameEn}</div>
                    <div className="text-sm text-gray-600">{t.nameAr}</div>
                    {t.description ? (
                      <p className="mt-1 text-sm text-gray-600">{t.description}</p>
                    ) : null}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}


