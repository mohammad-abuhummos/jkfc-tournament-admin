import * as React from "react";
import { Link, useNavigate } from "react-router";

import type { Route } from "./+types/index";
import { useAuth } from "~/auth/auth";
import { FullPageSpinner } from "~/components/FullPageSpinner";
import { createTournament, subscribeToUserTournaments } from "~/features/tournaments/api";
import type { Tournament } from "~/features/tournaments/types";

export function meta({ }: Route.MetaArgs) {
  return [{ title: "Select Tournament | JKFC Admin" }];
}

export default function DashboardIndex() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [tournaments, setTournaments] = React.useState<Tournament[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [query, setQuery] = React.useState("");

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

  const filteredTournaments = filterTournaments(tournaments, query);
  const stats = getTournamentStats(tournaments);

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-gray-200 bg-white p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Dashboard</h1>
            <p className="mt-1 text-sm text-gray-600">
              Select a tournament or create a new one.
            </p>
          </div>

          <div className="min-w-[260px]">
            <label className="block">
              <span className="sr-only">Search tournaments</span>
              <input
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search tournaments..."
              />
            </label>
          </div>
        </div>

        {error ? (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <StatCard label="Tournaments" value={String(stats.total)} />
          <StatCard label="Published" value={String(stats.published)} tone="success" />
          <StatCard label="Draft" value={String(stats.draft)} tone="warning" />
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-gray-200 p-4">
            <div className="text-sm font-semibold text-gray-900">Status chart</div>
            <p className="mt-1 text-sm text-gray-600">
              Distribution of tournaments by status.
            </p>
            <div className="mt-4">
              <StatusStackBar
                published={stats.published}
                draft={stats.draft}
              />
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 p-4">
            <div className="text-sm font-semibold text-gray-900">Activity</div>
            <p className="mt-1 text-sm text-gray-600">
              Tournaments created in the last 7 days.
            </p>
            <div className="mt-4">
              <MiniBarChart data={stats.createdLast7Days} />
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_420px]">
        <div className="rounded-2xl border border-gray-200 bg-white p-6">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-gray-900">Tournaments</h2>
            <span className="text-sm text-gray-600">
              {filteredTournaments.length}/{tournaments.length}
            </span>
          </div>

          <div className="mt-4">
            {loading ? (
              <div className="text-sm text-gray-600">Loading tournaments...</div>
            ) : filteredTournaments.length === 0 ? (
              <div className="text-sm text-gray-600">
                {tournaments.length === 0
                  ? "No tournaments yet."
                  : "No results. Try a different search."}
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {filteredTournaments.map((t) => (
                  <Link
                    key={t.id}
                    to={`/dashboard/tournaments/${t.id}`}
                    className="rounded-xl border border-gray-200 bg-white p-4 hover:border-gray-300 hover:shadow-sm transition"
                  >
                    <div className="flex items-start gap-3">
                      <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg border border-gray-200 bg-gray-50">
                        {t.logoUrl ? (
                          <img
                            src={t.logoUrl}
                            alt={t.nameEn || "Tournament"}
                            className="h-full w-full object-cover"
                          />
                        ) : null}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="truncate font-semibold text-gray-900">
                              {t.nameEn || "Untitled"}
                            </div>
                            <div className="truncate text-sm text-gray-600">{t.nameAr}</div>
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
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-6">
          <h2 className="text-lg font-semibold text-gray-900">Create tournament</h2>
          <p className="mt-1 text-sm text-gray-600">
            You can edit logo/status later from Settings.
          </p>

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
              className="w-full rounded-lg bg-blue-600 px-4 py-2 font-medium text-white disabled:opacity-60"
              disabled={creating}
            >
              {creating ? "Creating..." : "Create tournament"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: "neutral" | "success" | "warning";
}) {
  const toneClasses =
    tone === "success"
      ? "bg-emerald-50 border-emerald-200"
      : tone === "warning"
        ? "bg-amber-50 border-amber-200"
        : "bg-gray-50 border-gray-200";

  return (
    <div className={["rounded-xl border p-4", toneClasses].join(" ")}>
      <div className="text-xs font-medium uppercase tracking-wide text-gray-600">
        {label}
      </div>
      <div className="mt-1 text-2xl font-semibold text-gray-900">{value}</div>
    </div>
  );
}

function StatusStackBar({ published, draft }: { published: number; draft: number }) {
  const total = published + draft;
  const publishedPct = total ? (published / total) * 100 : 0;
  const draftPct = total ? (draft / total) * 100 : 0;

  return (
    <div className="space-y-2">
      <div className="flex h-3 overflow-hidden rounded-full bg-gray-100">
        <div
          className="bg-emerald-500"
          style={{ width: `${publishedPct}%` }}
          aria-hidden="true"
        />
        <div
          className="bg-amber-400"
          style={{ width: `${draftPct}%` }}
          aria-hidden="true"
        />
      </div>
      <div className="flex flex-wrap gap-3 text-xs text-gray-700">
        <span className="flex items-center gap-2">
          <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
          Published: {published}
        </span>
        <span className="flex items-center gap-2">
          <span className="inline-block h-2 w-2 rounded-full bg-amber-400" />
          Draft: {draft}
        </span>
      </div>
    </div>
  );
}

function MiniBarChart({ data }: { data: Array<{ label: string; value: number }> }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="grid gap-2">
      <div className="flex items-end gap-1" style={{ height: 64 }}>
        {data.map((d) => {
          const h = Math.round((d.value / max) * 64);
          return (
            <div key={d.label} className="flex-1">
              <div
                className="w-full rounded bg-blue-500"
                style={{ height: h }}
                title={`${d.label}: ${d.value}`}
                aria-label={`${d.label}: ${d.value}`}
              />
            </div>
          );
        })}
      </div>
      <div className="flex justify-between gap-1 text-[11px] text-gray-600">
        {data.map((d) => (
          <span key={d.label} className="flex-1 text-center">
            {d.label}
          </span>
        ))}
      </div>
    </div>
  );
}

function filterTournaments(tournaments: Tournament[], query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return tournaments;
  return tournaments.filter((t) => {
    const hay = `${t.nameEn} ${t.nameAr} ${t.description ?? ""}`.toLowerCase();
    return hay.includes(q);
  });
}

function getTournamentStats(tournaments: Tournament[]) {
  const total = tournaments.length;
  const published = tournaments.filter((t) => t.status === "published").length;
  const draft = tournaments.filter((t) => t.status === "draft").length;

  const last7 = getLastNDays(7);
  const byDay = new Map<string, number>(last7.map((d) => [d.key, 0]));

  for (const t of tournaments) {
    const dt = toDateMaybe((t as unknown as { createdAt?: unknown }).createdAt);
    if (!dt) continue;
    const key = isoDateKey(dt);
    if (!byDay.has(key)) continue;
    byDay.set(key, (byDay.get(key) ?? 0) + 1);
  }

  const createdLast7Days = last7.map((d) => ({
    label: d.label,
    value: byDay.get(d.key) ?? 0,
  }));

  return { total, published, draft, createdLast7Days };
}

function getLastNDays(n: number) {
  const days: Array<{ key: string; label: string }> = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    const key = isoDateKey(d);
    days.push({ key, label: String(d.getDate()) });
  }
  return days;
}

function isoDateKey(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function toDateMaybe(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (
    typeof value === "object" &&
    value &&
    "toDate" in value &&
    typeof (value as { toDate?: unknown }).toDate === "function"
  ) {
    try {
      return (value as { toDate: () => Date }).toDate();
    } catch {
      return null;
    }
  }
  return null;
}


