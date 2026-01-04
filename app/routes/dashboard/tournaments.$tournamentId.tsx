import * as React from "react";
import { Link, NavLink, Outlet, useParams } from "react-router";

import type { Route } from "./+types/tournaments.$tournamentId";
import { FullPageSpinner } from "~/components/FullPageSpinner";
import { subscribeToTournament } from "~/features/tournaments/api";
import type { Tournament } from "~/features/tournaments/types";

export function meta({ params }: Route.MetaArgs) {
  return [{ title: `Tournament ${params.tournamentId} | JKFC Admin` }];
}

export default function TournamentLayout() {
  const { tournamentId } = useParams();
  if (!tournamentId) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-6">
        <p className="text-gray-700">Tournament id is missing.</p>
        <Link className="text-blue-700 hover:underline" to="/dashboard">
          Back to dashboard
        </Link>
      </div>
    );
  }

  return <TournamentLayoutInner tournamentId={tournamentId} />;
}

function TournamentLayoutInner({ tournamentId }: { tournamentId: string }) {
  const [tournament, setTournament] = React.useState<Tournament | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    setLoading(true);
    setError(null);

    void (async () => {
      try {
        unsubscribe = await subscribeToTournament(
          tournamentId,
          (t) => {
            setTournament(t);
            setLoading(false);
          },
          (err) => {
            console.error("[TournamentLayout] subscribeToTournament failed", err);
            setError("Failed to load tournament.");
            setLoading(false);
          },
        );
      } catch (err) {
        console.error("[TournamentLayout] subscribeToTournament failed", err);
        setError("Failed to load tournament.");
        setLoading(false);
      }
    })();

    return () => unsubscribe?.();
  }, [tournamentId]);

  if (loading) return <FullPageSpinner label="Loading tournament..." />;

  if (error) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-6">
        <p className="text-red-700">{error}</p>
        <Link className="text-blue-700 hover:underline" to="/dashboard">
          Back to dashboard
        </Link>
      </div>
    );
  }

  if (!tournament) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-6">
        <p className="text-gray-700">Tournament not found.</p>
        <Link className="text-blue-700 hover:underline" to="/dashboard">
          Back to dashboard
        </Link>
      </div>
    );
  }

  const base = `/dashboard/tournaments/${tournamentId}`;

  return (
    <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
      <aside className="rounded-2xl border border-gray-200 bg-white p-4">
        <div className="mb-4">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg border border-gray-200 bg-gray-50">
              {tournament.logoUrl ? (
                <img
                  src={tournament.logoUrl}
                  alt={tournament.nameEn}
                  className="h-full w-full object-cover"
                />
              ) : null}
            </div>
            <div className="min-w-0">
              <div className="text-sm font-semibold text-gray-900">
                {tournament.nameEn}
              </div>
              <div className="text-sm text-gray-600">{tournament.nameAr}</div>
            </div>
          </div>
        </div>

        <nav className="space-y-1">
          <MenuLink to={base} label="Overview" end />
          <MenuLink to={`${base}/teams`} label="Teams" />
          <MenuLink to={`${base}/groups`} label="Groups" />
          <MenuLink to={`${base}/matches`} label="Matches" />
          <MenuLink to={`${base}/bracket`} label="Bracket" />
          <MenuLink to={`${base}/settings`} label="Settings" />
        </nav>

        <div className="mt-6 border-t border-gray-200 pt-4">
          <Link className="text-sm text-blue-700 hover:underline" to="/dashboard">
            ← Change tournament
          </Link>
        </div>
      </aside>

      <section className="min-w-0">
        <Outlet context={{ tournamentId, tournament }} />
      </section>
    </div>
  );
}

function MenuLink({
  to,
  label,
  end,
}: {
  to: string;
  label: string;
  end?: boolean;
}) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        [
          "block rounded-lg px-3 py-2 text-sm font-medium",
          isActive ? "bg-blue-50 text-blue-800" : "text-gray-700 hover:bg-gray-50",
        ].join(" ")
      }
    >
      {label}
    </NavLink>
  );
}


