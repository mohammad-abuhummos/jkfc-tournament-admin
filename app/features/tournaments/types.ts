import type { Timestamp } from "firebase/firestore";

export type TournamentStatus = "draft" | "published";

export type TournamentDoc = {
  nameEn: string;
  nameAr: string;
  description?: string;
  logoUrl?: string;
  logoPath?: string;
  status: TournamentStatus;
  createdBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
};

export type Tournament = TournamentDoc & { id: string };

export type TeamDoc = {
  nameEn: string;
  nameAr: string;
  description?: string;
  logoUrl?: string;
  logoPath?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
};

export type Team = TeamDoc & { id: string };

export type GroupDoc = {
  name: string;
  order: number;
  teamIds: string[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
};

export type Group = GroupDoc & { id: string };

export type MatchStatus = "scheduled" | "finished";

export type TournamentMatchDoc = {
  groupId?: string | null;
  team1Id: string;
  team2Id: string;
  scheduledAt?: Timestamp | null;
  status: MatchStatus;
  score1?: number | null;
  score2?: number | null;
  winnerTeamId?: string | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  finishedAt?: Timestamp | null;
};

export type TournamentMatch = TournamentMatchDoc & { id: string };

/**
 * Bracket state (single-elimination) stored as a single doc under:
 * `tournaments/{tournamentId}/bracket/state`
 */
export type BracketMatch = {
  id: string;
  team1Id: string | null;
  team2Id: string | null;
  score1?: number | null;
  score2?: number | null;
  winnerTeamId?: string | null;
  status?: MatchStatus;
};

export type BracketRound = {
  name: string;
  matches: BracketMatch[];
};

export type BracketState = {
  format: "single_elimination";
  size: number;
  rounds: BracketRound[];
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
};

/**
 * Event Bracket Types - Tree-style bracket with left/right sides
 */
export type EventBracketMatch = {
  id: string;
  team1Id: string | null;
  team2Id: string | null;
  score1: number | null;
  score2: number | null;
  winnerId: string | null;
  status: "pending" | "scheduled" | "finished";
};

export type EventBracketSide = {
  groupId: string | null;
  round1Matches: EventBracketMatch[];
  winnerSlots: Array<{ id: string; teamId: string | null }>;
};

export type EventBracketState = {
  leftSide: EventBracketSide;
  rightSide: EventBracketSide;
  semiFinals: EventBracketMatch[];
  thirdPlace: EventBracketMatch;
  final: EventBracketMatch;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
};


