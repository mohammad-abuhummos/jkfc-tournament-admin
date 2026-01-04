import * as React from "react";
import { Link, useNavigate } from "react-router";

import type { Route } from "./+types/index";
import { useAuth } from "~/auth/auth";
import { FullPageSpinner } from "~/components/FullPageSpinner";
import { createTournament, subscribeToUserTournaments } from "~/features/tournaments/api";
import type { Tournament } from "~/features/tournaments/types";

export function meta({}: Route.MetaArgs) {
  return [{ title: "Select Tournament | JKFC Admin" }];
}

export default function DashboardIndex() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [tournaments, setTournaments] = React.useState<Tournament[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const [nameEn, setNameEn] = React.useState("");
  const [nameAr, setNameAr] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [creating, setCreating] = React.useState(false);

  React.useEffect(() => {
    if (authLoading) return;
    if (!user) return;

    let unsubscribe: (() => void) | undefined;
    setLoading(true);
    setError(null);

    void (async () => {
      try {
        unsubscribe = await subscribeToUserTournaments(
          user.uid,
          (items) => {
            setTournaments(items);
            setLoading(false);
          },
          (err) => {
            console.error("[Dashboard] subscribeToUserTournaments failed", err);
            setError("Failed to load tournaments.");
            setLoading(false);
          },
        );
      } catch (err) {
        console.error("[Dashboard] subscribeToUserTournaments failed", err);
        setError("Failed to load tournaments.");
        setLoading(false);
      }
    })();

    return () => unsubscribe?.();
  }, [authLoading, user]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;

    setCreating(true);
    setError(null);

    try {
      const id = await createTournament({
        userId: user.uid,
        nameEn: nameEn.trim(),
        nameAr: nameAr.trim(),
        description: description.trim(),
      });
      setNameEn("");
      setNameAr("");
      setDescription("");
      navigate(`/dashboard/tournaments/${id}`);
    } catch (err) {
      console.error("[Dashboard] createTournament failed", err);
      setError("Failed to create tournament.");
    } finally {
      setCreating(false);
    }
  }

  if (authLoading) return <FullPageSpinner label="Loading..." />;

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-gray-200 bg-white p-6">
        <h1 className="text-xl font-semibold text-gray-900">Tournament</h1>
        <p className="mt-1 text-sm text-gray-600">
          Select an existing tournament or create a new one.
        </p>

        {error ? (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        <div className="mt-6">
          {loading ? (
            <div className="text-sm text-gray-600">Loading tournaments...</div>
          ) : tournaments.length === 0 ? (
            <div className="text-sm text-gray-600">No tournaments yet.</div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {tournaments.map((t) => (
                <Link
                  key={t.id}
                  to={`/dashboard/tournaments/${t.id}`}
                  className="rounded-xl border border-gray-200 bg-white p-4 hover:border-gray-300 hover:shadow-sm transition"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold text-gray-900">
                        {t.nameEn || "Untitled"}
                      </div>
                      <div className="text-sm text-gray-600">{t.nameAr}</div>
                    </div>
                    <span className="rounded-full bg-gray-100 px-2 py-1 text-xs font-medium text-gray-700">
                      {t.status}
                    </span>
                  </div>
                  {t.description ? (
                    <p className="mt-2 line-clamp-2 text-sm text-gray-600">
                      {t.description}
                    </p>
                  ) : null}
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-gray-900">Create tournament</h2>
        <form className="mt-4 space-y-4" onSubmit={handleCreate}>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="text-sm font-medium text-gray-700">
                Name (EN)
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
                Name (AR)
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

          <button
            type="submit"
            className="rounded-lg bg-blue-600 px-4 py-2 font-medium text-white disabled:opacity-60"
            disabled={creating}
          >
            {creating ? "Creating..." : "Create tournament"}
          </button>
        </form>
      </div>
    </div>
  );
}


