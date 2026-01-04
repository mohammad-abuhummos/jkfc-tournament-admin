import * as React from "react";
import { Link } from "react-router";

import type { Route } from "./+types/tournaments.$tournamentId.index";
import {
  subscribeToTournamentBracketState,
  subscribeToTournamentGroups,
  subscribeToTournamentMatches,
  subscribeToTournamentTeams,
} from "~/features/tournaments/api";
import { useTournamentManager } from "~/features/tournaments/context";
import type { BracketState } from "~/features/tournaments/types";

export function meta({}: Route.MetaArgs) {
  return [{ title: "Tournament Overview | JKFC Admin" }];
}

export default function TournamentOverview() {
  const { tournamentId, tournament } = useTournamentManager();

  const [teamsCount, setTeamsCount] = React.useState(0);
  const [groups, setGroups] = React.useState<
    Array<{ id: string; name: string; order: number; teamIds: string[] }>
  >([]);
  const [matches, setMatches] = React.useState<Array<{ id: string; status: string }>>([]);
  const [bracket, setBracket] = React.useState<BracketState | null>(null);
  const [statsLoading, setStatsLoading] = React.useState(true);
  const [statsError, setStatsError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let mounted = true;
    let unsubTeams: (() => void) | undefined;
    let unsubGroups: (() => void) | undefined;
    let unsubMatches: (() => void) | undefined;
    let unsubBracket: (() => void) | undefined;

    setStatsLoading(true);
    setStatsError(null);

    const loaded = { teams: false, groups: false, matches: false, bracket: false };
    function markLoaded(key: keyof typeof loaded) {
      loaded[key] = true;
      if (loaded.teams && loaded.groups && loaded.matches && loaded.bracket) {
        setStatsLoading(false);
      }
    }

    void (async () => {
      try {
        unsubTeams = await subscribeToTournamentTeams(
          tournamentId,
          (items) => {
            if (!mounted) return;
            setTeamsCount(items.length);
            markLoaded("teams");
          },
          (err) => {
            console.warn("[Overview] teams subscribe failed", err);
            if (!mounted) return;
            setStatsError((prev) => prev ?? "Some stats failed to load.");
            markLoaded("teams");
          },
        );

        unsubGroups = await subscribeToTournamentGroups(
          tournamentId,
          (items) => {
            if (!mounted) return;
            setGroups(items);
            markLoaded("groups");
          },
          (err) => {
            console.warn("[Overview] groups subscribe failed", err);
            if (!mounted) return;
            setStatsError((prev) => prev ?? "Some stats failed to load.");
            markLoaded("groups");
          },
        );

        unsubMatches = await subscribeToTournamentMatches(
          tournamentId,
          (items) => {
            if (!mounted) return;
            setMatches(items);
            markLoaded("matches");
          },
          (err) => {
            console.warn("[Overview] matches subscribe failed", err);
            if (!mounted) return;
            setStatsError((prev) => prev ?? "Some stats failed to load.");
            markLoaded("matches");
          },
        );

        unsubBracket = await subscribeToTournamentBracketState(
          tournamentId,
          (state) => {
            if (!mounted) return;
            setBracket(state);
            markLoaded("bracket");
          },
          (err) => {
            console.warn("[Overview] bracket subscribe failed", err);
            if (!mounted) return;
            setStatsError((prev) => prev ?? "Some stats failed to load.");
            markLoaded("bracket");
          },
        );
      } catch (err) {
        console.warn("[Overview] stats subscribe failed", err);
        if (!mounted) return;
        setStatsError("Failed to load stats.");
        setStatsLoading(false);
      }
    })();

    return () => {
      mounted = false;
      unsubTeams?.();
      unsubGroups?.();
      unsubMatches?.();
      unsubBracket?.();
    };
  }, [tournamentId]);

  const groupsSorted = React.useMemo(
    () => [...groups].sort((a, b) => a.order - b.order),
    [groups],
  );

  const matchesFinished = React.useMemo(
    () => matches.filter((m) => m.status === "finished").length,
    [matches],
  );

  const bracketProgress = React.useMemo(() => {
    if (!bracket) return null;
    const total = bracket.rounds.reduce((sum, r) => sum + r.matches.length, 0);
    const finished = bracket.rounds.reduce(
      (sum, r) => sum + r.matches.filter((m) => m.status === "finished").length,
      0,
    );
    return { total, finished };
  }, [bracket]);

  const base = `/dashboard/tournaments/${tournamentId}`;

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-gray-200 bg-white p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="h-16 w-16 overflow-hidden rounded-2xl border border-gray-200 bg-gray-50">
              {tournament.logoUrl ? (
                <img
                  src={tournament.logoUrl}
                  alt={tournament.nameEn}
                  className="h-full w-full object-cover"
                />
              ) : null}
            </div>

            <div>
              <h1 className="text-xl font-semibold text-gray-900">Overview</h1>
              <p className="mt-1 text-sm text-gray-600">
                {tournament.nameEn} • {tournament.nameAr}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="rounded-full bg-gray-100 px-2 py-1 text-xs font-medium text-gray-700">
              {tournament.status}
            </span>
            <Link
              to={`${base}/settings`}
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50"
            >
              Settings
            </Link>
          </div>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Teams" value={String(teamsCount)} loading={statsLoading} />
          <StatCard label="Groups" value={String(groupsSorted.length)} loading={statsLoading} />
          <StatCard
            label="Matches"
            value={`${matchesFinished}/${matches.length}`}
            loading={statsLoading}
          />
          <StatCard
            label="Bracket"
            value={
              bracketProgress
                ? `${bracketProgress.finished}/${bracketProgress.total}`
                : "Not generated"
            }
            loading={statsLoading}
          />
        </div>

        {statsError ? (
          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            {statsError}
          </div>
        ) : null}

        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-gray-200 p-4">
            <div className="text-sm font-semibold text-gray-900">Matches progress</div>
            <p className="mt-1 text-sm text-gray-600">
              Finished vs scheduled matches.
            </p>
            <div className="mt-4">
              <StackBar
                a={matchesFinished}
                b={Math.max(0, matches.length - matchesFinished)}
                aLabel="Finished"
                bLabel="Scheduled"
                aClass="bg-emerald-500"
                bClass="bg-amber-400"
              />
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 p-4">
            <div className="text-sm font-semibold text-gray-900">Group sizes</div>
            <p className="mt-1 text-sm text-gray-600">Teams per group.</p>
            <div className="mt-4">
              {groupsSorted.length === 0 ? (
                <div className="text-sm text-gray-600">No groups yet.</div>
              ) : (
                <GroupSizesChart
                  groups={groupsSorted.map((g) => ({
                    name: g.name,
                    teamCount: g.teamIds.length,
                  }))}
                />
              )}
            </div>
          </div>
        </div>

        {tournament.description ? (
          <div className="mt-6">
            <div className="text-sm font-medium text-gray-700">Description</div>
            <p className="mt-1 text-sm text-gray-700">{tournament.description}</p>
          </div>
        ) : null}
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-gray-900">Quick actions</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
          <QuickLink to={`${base}/teams`} label="Teams" />
          <QuickLink to={`${base}/groups`} label="Groups" />
          <QuickLink to={`${base}/matches`} label="Matches" />
          <QuickLink to={`${base}/bracket`} label="Bracket" />
          <QuickLink to={`${base}/event`} label="Event" />
          <QuickLink to={`${base}/settings`} label="Settings" />
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  loading,
}: {
  label: string;
  value: string;
  loading: boolean;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
      <div className="text-xs font-medium uppercase tracking-wide text-gray-500">
        {label}
      </div>
      <div className="mt-1 text-2xl font-semibold text-gray-900">
        {loading ? "…" : value}
      </div>
    </div>
  );
}

function StackBar({
  a,
  b,
  aLabel,
  bLabel,
  aClass,
  bClass,
}: {
  a: number;
  b: number;
  aLabel: string;
  bLabel: string;
  aClass: string;
  bClass: string;
}) {
  const total = a + b;
  const aPct = total ? (a / total) * 100 : 0;
  const bPct = total ? (b / total) * 100 : 0;

  return (
    <div className="space-y-2">
      <div className="flex h-3 overflow-hidden rounded-full bg-gray-100">
        <div className={aClass} style={{ width: `${aPct}%` }} />
        <div className={bClass} style={{ width: `${bPct}%` }} />
      </div>
      <div className="flex flex-wrap gap-3 text-xs text-gray-700">
        <span className="flex items-center gap-2">
          <span className={["inline-block h-2 w-2 rounded-full", aClass].join(" ")} />
          {aLabel}: {a}
        </span>
        <span className="flex items-center gap-2">
          <span className={["inline-block h-2 w-2 rounded-full", bClass].join(" ")} />
          {bLabel}: {b}
        </span>
      </div>
    </div>
  );
}

function GroupSizesChart({
  groups,
}: {
  groups: Array<{ name: string; teamCount: number }>;
}) {
  const max = Math.max(1, ...groups.map((g) => g.teamCount));
  return (
    <div className="space-y-2">
      {groups.map((g) => {
        const pct = Math.round((g.teamCount / max) * 100);
        return (
          <div
            key={g.name}
            className="grid grid-cols-[80px_1fr_32px] items-center gap-2"
          >
            <div className="truncate text-xs font-medium text-gray-700" title={g.name}>
              {g.name}
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-gray-100">
              <div className="h-full bg-blue-500" style={{ width: `${pct}%` }} />
            </div>
            <div className="text-right text-xs font-semibold text-gray-900">
              {g.teamCount}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function QuickLink({ to, label }: { to: string; label: string }) {
  return (
    <Link
      to={to}
      className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50 text-center"
    >
      {label}
    </Link>
  );
}


