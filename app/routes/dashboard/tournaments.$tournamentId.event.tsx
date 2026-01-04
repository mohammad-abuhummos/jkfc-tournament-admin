import * as React from "react";

import type { Route } from "./+types/tournaments.$tournamentId.event";
import { useTournamentManager } from "~/features/tournaments/context";

export function meta({}: Route.MetaArgs) {
  return [{ title: "Event | JKFC Admin" }];
}

export default function TournamentEvent() {
  const { tournamentId, tournament } = useTournamentManager();

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-gray-200 bg-white p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Event</h1>
            <p className="mt-1 text-sm text-gray-600">
              Manage event details for {tournament.nameEn}
            </p>
          </div>
        </div>

        <div className="mt-6">
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-8 text-center">
            <div className="mx-auto h-12 w-12 rounded-full bg-gray-100 flex items-center justify-center">
              <svg
                className="h-6 w-6 text-gray-400"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5"
                />
              </svg>
            </div>
            <h3 className="mt-4 text-sm font-medium text-gray-900">
              Event management
            </h3>
            <p className="mt-2 text-sm text-gray-600">
              Configure event details, schedule, and venue information here.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

