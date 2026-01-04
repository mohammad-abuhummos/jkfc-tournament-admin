import { useOutletContext } from "react-router";

import type { BracketState, Tournament } from "./types";

export type TournamentStats = {
  teamsCount: number;
  groupsCount: number;
  groupSizes: Array<{ id: string; name: string; teamCount: number }>;
  matchesTotal: number;
  matchesFinished: number;
  bracket: BracketState | null;
  bracketTotalMatches: number | null;
  bracketFinishedMatches: number | null;
  loading: boolean;
};

export type TournamentManagerContext = {
  tournamentId: string;
  tournament: Tournament;
  /**
   * Optional shared stats object.
   * Some routes may compute stats locally instead of passing them via outlet context.
   */
  stats?: TournamentStats;
};

export function useTournamentManager() {
  return useOutletContext<TournamentManagerContext>();
}


