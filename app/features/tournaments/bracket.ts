import type { BracketMatch, BracketRound, BracketState } from "./types";

export function isPowerOfTwo(n: number) {
  return n > 0 && (n & (n - 1)) === 0;
}

export function generateSingleEliminationBracket(input: {
  teamIds: string[];
  size: number;
}): BracketState {
  const { teamIds, size } = input;

  if (!isPowerOfTwo(size)) {
    throw new Error("Bracket size must be a power of two (4, 8, 16, 32...)");
  }
  if (teamIds.length !== size) {
    throw new Error(`Please select exactly ${size} teams to seed the bracket.`);
  }

  const roundsCount = Math.log2(size);
  const rounds: BracketRound[] = [];

  // Round 1
  const round1TeamsRemaining = size;
  const round1: BracketRound = {
    name: getRoundName(round1TeamsRemaining),
    matches: Array.from({ length: size / 2 }, (_, idx) => {
      const team1Id = teamIds[idx * 2] ?? null;
      const team2Id = teamIds[idx * 2 + 1] ?? null;
      return emptyMatch(`R1-M${idx + 1}`, team1Id, team2Id);
    }),
  };
  rounds.push(round1);

  // Next rounds (empty placeholders, teams filled from winners)
  for (let r = 1; r < roundsCount; r++) {
    const teamsRemaining = size / 2 ** r;
    rounds.push({
      name: getRoundName(teamsRemaining),
      matches: Array.from({ length: teamsRemaining / 2 }, (_, idx) =>
        emptyMatch(`R${r + 1}-M${idx + 1}`, null, null),
      ),
    });
  }

  return {
    format: "single_elimination",
    size,
    rounds,
  };
}

export function setBracketMatchResult(
  state: BracketState,
  input: { roundIndex: number; matchIndex: number; score1: number; score2: number },
): BracketState {
  const next = cloneBracket(state);
  const match = next.rounds[input.roundIndex]?.matches[input.matchIndex];
  if (!match) throw new Error("Match not found");

  if (!match.team1Id || !match.team2Id) {
    throw new Error("Both teams must be set before entering a result.");
  }
  if (input.score1 === input.score2) {
    throw new Error("A knockout match cannot end in a draw. Please pick a winner.");
  }

  const winnerTeamId = input.score1 > input.score2 ? match.team1Id : match.team2Id;

  match.score1 = input.score1;
  match.score2 = input.score2;
  match.winnerTeamId = winnerTeamId;
  match.status = "finished";

  // Propagate winner to the next round slot and clear downstream results on that path.
  const nextRound = next.rounds[input.roundIndex + 1];
  if (nextRound) {
    const nextMatchIndex = Math.floor(input.matchIndex / 2);
    const slotKey = input.matchIndex % 2 === 0 ? "team1Id" : "team2Id";
    const nextMatch = nextRound.matches[nextMatchIndex];
    if (nextMatch) {
      const prev = nextMatch[slotKey];
      if (prev !== winnerTeamId) {
        nextMatch[slotKey] = winnerTeamId;
        clearResultAndDownstream(next, input.roundIndex + 1, nextMatchIndex);
      }
    }
  }

  return next;
}

function clearResultAndDownstream(state: BracketState, roundIndex: number, matchIndex: number) {
  let r = roundIndex;
  let m = matchIndex;

  while (true) {
    const match = state.rounds[r]?.matches[m];
    if (!match) return;

    match.score1 = null;
    match.score2 = null;
    match.winnerTeamId = null;
    match.status = "scheduled";

    const nextRound = state.rounds[r + 1];
    if (!nextRound) return;

    const nextMatchIndex = Math.floor(m / 2);
    const slotKey = m % 2 === 0 ? "team1Id" : "team2Id";
    const nextMatch = nextRound.matches[nextMatchIndex];
    if (!nextMatch) return;

    nextMatch[slotKey] = null;
    r += 1;
    m = nextMatchIndex;
  }
}

function emptyMatch(id: string, team1Id: string | null, team2Id: string | null): BracketMatch {
  return {
    id,
    team1Id,
    team2Id,
    score1: null,
    score2: null,
    winnerTeamId: null,
    status: "scheduled",
  };
}

function getRoundName(teamsRemaining: number) {
  if (teamsRemaining === 2) return "Final";
  if (teamsRemaining === 4) return "Semi Final";
  if (teamsRemaining === 8) return "Quarter Final";
  return `Round of ${teamsRemaining}`;
}

function cloneBracket(state: BracketState): BracketState {
  return {
    ...state,
    rounds: state.rounds.map((r) => ({
      ...r,
      matches: r.matches.map((m) => ({ ...m })),
    })),
  };
}


