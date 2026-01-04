import { Link } from "react-router";

import type { Route } from "./+types/tournaments.$tournamentId.index";
import { useTournamentManager } from "~/features/tournaments/context";

export function meta({}: Route.MetaArgs) {
  return [{ title: "Tournament Overview | JKFC Admin" }];
}

export default function TournamentOverview() {
  const { tournamentId, tournament } = useTournamentManager();

  return (
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
            to={`/dashboard/tournaments/${tournamentId}/settings`}
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50"
          >
            Settings
          </Link>
        </div>
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Field label="Name (EN)" value={tournament.nameEn} />
        <Field label="Name (AR)" value={tournament.nameAr} />
        <Field label="Status" value={tournament.status} />
      </div>
      {tournament.description ? (
        <div className="mt-4">
          <div className="text-sm font-medium text-gray-700">Description</div>
          <p className="mt-1 text-sm text-gray-700">{tournament.description}</p>
        </div>
      ) : null}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
      <div className="text-xs font-medium uppercase tracking-wide text-gray-500">
        {label}
      </div>
      <div className="mt-1 text-sm font-semibold text-gray-900">{value}</div>
    </div>
  );
}


