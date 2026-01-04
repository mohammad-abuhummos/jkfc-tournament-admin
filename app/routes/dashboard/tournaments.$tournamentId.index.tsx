import type { Route } from "./+types/tournaments.$tournamentId.index";
import { useTournamentManager } from "~/features/tournaments/context";

export function meta({}: Route.MetaArgs) {
  return [{ title: "Tournament Overview | JKFC Admin" }];
}

export default function TournamentOverview() {
  const { tournament } = useTournamentManager();

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6">
      <h1 className="text-xl font-semibold text-gray-900">Overview</h1>
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


