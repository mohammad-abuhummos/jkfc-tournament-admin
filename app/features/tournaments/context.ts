import { useOutletContext } from "react-router";

import type { Tournament } from "./types";

export type TournamentManagerContext = {
  tournamentId: string;
  tournament: Tournament;
};

export function useTournamentManager() {
  return useOutletContext<TournamentManagerContext>();
}


