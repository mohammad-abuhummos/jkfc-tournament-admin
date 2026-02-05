import * as React from "react";
import { useCallback, useEffect, useState, useRef } from "react";

import type { Route } from "./+types/tournaments.$tournamentId.event";
import { useAuth } from "~/auth/auth";
import {
  createTournamentMatch,
  deleteTournamentMatch,
  saveEventBracketState,
  setTournamentMatchResult,
  subscribeToEventBracketState,
  subscribeToTournamentGroups,
  subscribeToTournamentMatches,
  subscribeToTournamentTeams,
  updateTournamentMatch,
} from "~/features/tournaments/api";
import { useTournamentManager } from "~/features/tournaments/context";
import type {
  EventBracketMatch,
  EventBracketState,
  Group,
  Team,
  TournamentMatch,
} from "~/features/tournaments/types";

export function meta({ }: Route.MetaArgs) {
  return [{ title: "Event | JKFC Admin" }];
}

// ============================================
// TYPES
// ============================================

type ContextMenuState = {
  x: number;
  y: number;
  type: "match" | "winner" | "group";
  matchId?: string;
  winnerId?: string;
  side?: "left" | "right";
  round?: "round1" | "semi" | "third" | "final";
} | null;

// ============================================
// HELPER FUNCTIONS
// ============================================

function generateInitialBracket(): EventBracketState {
  const createMatch = (id: string): EventBracketMatch => ({
    id,
    team1Id: null,
    team2Id: null,
    score1: null,
    score2: null,
    winnerId: null,
    status: "pending",
  });

  return {
    leftSide: {
      groupId: null,
      round1Matches: Array.from({ length: 6 }, (_, i) => createMatch(`L1-${i}`)),
      winnerSlots: Array.from({ length: 2 }, (_, i) => ({ id: `LW-${i}`, teamId: null })),
    },
    rightSide: {
      groupId: null,
      round1Matches: Array.from({ length: 6 }, (_, i) => createMatch(`R1-${i}`)),
      winnerSlots: Array.from({ length: 2 }, (_, i) => ({ id: `RW-${i}`, teamId: null })),
    },
    semiFinals: [createMatch("SF-0"), createMatch("SF-1")],
    thirdPlace: createMatch("3RD"),
    final: createMatch("FINAL"),
  };
}

// ============================================
// CONTEXT MENU COMPONENT
// ============================================

type ContextMenuProps = {
  state: ContextMenuState;
  teams: Team[];
  groups: Group[];
  bracket: EventBracketState;
  onClose: () => void;
  onAssignTeam: (matchId: string, slot: 1 | 2, teamId: string | null, round: string, side?: "left" | "right") => void;
  onSetScore: (matchId: string, round: string, side?: "left" | "right") => void;
  onSetGroup: (side: "left" | "right", groupId: string | null) => void;
  onSetWinner: (winnerId: string, side: "left" | "right", teamId: string | null) => void;
  onClearMatch: (matchId: string, round: string, side?: "left" | "right") => void;
};

function ContextMenu({
  state,
  teams,
  groups,
  bracket,
  onClose,
  onAssignTeam,
  onSetScore,
  onSetGroup,
  onSetWinner,
  onClearMatch,
}: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [openSubmenu, setOpenSubmenu] = useState<"team1" | "team2" | null>(null);

  useEffect(() => {
    if (!state) {
      setOpenSubmenu(null);
      return;
    }
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (openSubmenu) {
          setOpenSubmenu(null);
        } else {
          onClose();
        }
      }
    };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [state, onClose, openSubmenu]);

  // Reset submenu when context menu closes
  useEffect(() => {
    if (!state) setOpenSubmenu(null);
  }, [state]);

  if (!state) return null;

  const { x, y, type, matchId, winnerId, side, round } = state;

  // Get available teams based on side's group
  const getAvailableTeams = () => {
    if (!side) return teams;
    const sideData = side === "left" ? bracket.leftSide : bracket.rightSide;
    if (!sideData.groupId) return teams;
    const group = groups.find((g) => g.id === sideData.groupId);
    if (!group) return teams;
    return teams.filter((t) => group.teamIds.includes(t.id));
  };

  const availableTeams = getAvailableTeams();

  // Get the match data
  const getMatch = (): EventBracketMatch | null => {
    if (!matchId) return null;
    if (round === "round1" && side) {
      const sideData = side === "left" ? bracket.leftSide : bracket.rightSide;
      return sideData.round1Matches.find((m) => m.id === matchId) ?? null;
    }
    if (round === "semi") {
      return bracket.semiFinals.find((m) => m.id === matchId) ?? null;
    }
    if (round === "third") {
      return bracket.thirdPlace;
    }
    if (round === "final") {
      return bracket.final;
    }
    return null;
  };

  const match = getMatch();

  // Calculate menu position to keep it on screen
  const menuStyle: React.CSSProperties = {
    left: Math.min(x, window.innerWidth - 220),
    top: Math.min(y, window.innerHeight - 300),
  };

  return (
    <div
      ref={menuRef}
      className="fixed z-[100] min-w-[200px] rounded-lg border border-gray-200 bg-white py-1 shadow-lg"
      style={menuStyle}
    >
      {type === "group" && side && (
        <>
          <div className="px-3 py-2 text-xs font-semibold uppercase text-gray-500">
            Set {side === "left" ? "Left" : "Right"} Side Group
          </div>
          <button
            className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-100"
            onClick={() => {
              onSetGroup(side, null);
              onClose();
            }}
          >
            No Group (All Teams)
          </button>
          {groups.map((group) => (
            <button
              key={group.id}
              className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-100"
              onClick={() => {
                onSetGroup(side, group.id);
                onClose();
              }}
            >
              {group.name}
            </button>
          ))}
        </>
      )}

      {type === "match" && matchId && round && (
        <>
          <div className="px-3 py-2 text-xs font-semibold uppercase text-gray-500">
            Match Actions
          </div>

          {/* Assign Team 1 - Click to toggle submenu */}
          <div className="relative">
            <button
              className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-gray-100 ${openSubmenu === "team1" ? "bg-blue-50 text-blue-700" : "text-gray-700"
                }`}
              onClick={() => setOpenSubmenu(openSubmenu === "team1" ? null : "team1")}
            >
              <span>Assign Team 1</span>
              <svg className={`h-4 w-4 transition-transform ${openSubmenu === "team1" ? "rotate-90" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
            {openSubmenu === "team1" && (
              <div className="absolute left-full top-0 z-10 ml-1 max-h-[300px] min-w-[180px] overflow-y-auto rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
                <button
                  className="w-full px-3 py-2 text-left text-sm text-gray-500 hover:bg-gray-100"
                  onClick={() => {
                    onAssignTeam(matchId, 1, null, round, side);
                    onClose();
                  }}
                >
                  TBD (Clear)
                </button>
                {availableTeams.map((team) => (
                  <button
                    key={team.id}
                    className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-100 ${match?.team1Id === team.id ? "bg-blue-50 text-blue-700" : "text-gray-700"
                      }`}
                    onClick={() => {
                      onAssignTeam(matchId, 1, team.id, round, side);
                      onClose();
                    }}
                  >
                    {team.nameEn}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Assign Team 2 - Click to toggle submenu */}
          <div className="relative">
            <button
              className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-gray-100 ${openSubmenu === "team2" ? "bg-blue-50 text-blue-700" : "text-gray-700"
                }`}
              onClick={() => setOpenSubmenu(openSubmenu === "team2" ? null : "team2")}
            >
              <span>Assign Team 2</span>
              <svg className={`h-4 w-4 transition-transform ${openSubmenu === "team2" ? "rotate-90" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
            {openSubmenu === "team2" && (
              <div className="absolute left-full top-0 z-10 ml-1 max-h-[300px] min-w-[180px] overflow-y-auto rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
                <button
                  className="w-full px-3 py-2 text-left text-sm text-gray-500 hover:bg-gray-100"
                  onClick={() => {
                    onAssignTeam(matchId, 2, null, round, side);
                    onClose();
                  }}
                >
                  TBD (Clear)
                </button>
                {availableTeams.map((team) => (
                  <button
                    key={team.id}
                    className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-100 ${match?.team2Id === team.id ? "bg-blue-50 text-blue-700" : "text-gray-700"
                      }`}
                    onClick={() => {
                      onAssignTeam(matchId, 2, team.id, round, side);
                      onClose();
                    }}
                  >
                    {team.nameEn}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="my-1 border-t border-gray-100" />

          <button
            className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-100"
            onClick={() => {
              onSetScore(matchId, round, side);
              onClose();
            }}
          >
            Set Score
          </button>

          <button
            className="w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50"
            onClick={() => {
              onClearMatch(matchId, round, side);
              onClose();
            }}
          >
            Clear Match
          </button>
        </>
      )}

      {type === "winner" && winnerId && side && (
        <>
          <div className="px-3 py-2 text-xs font-semibold uppercase text-gray-500">
            Set Winner Slot
          </div>
          <button
            className="w-full px-3 py-2 text-left text-sm text-gray-500 hover:bg-gray-100"
            onClick={() => {
              onSetWinner(winnerId, side, null);
              onClose();
            }}
          >
            TBD (Clear)
          </button>
          {availableTeams.map((team) => (
            <button
              key={team.id}
              className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-100"
              onClick={() => {
                onSetWinner(winnerId, side, team.id);
                onClose();
              }}
            >
              {team.nameEn}
            </button>
          ))}
        </>
      )}
    </div>
  );
}

// ============================================
// MODAL COMPONENTS
// ============================================

type ModalProps = {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
};

function Modal({ open, title, onClose, children }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
        aria-label="Close modal"
      />
      <div
        role="dialog"
        aria-modal="true"
        className="relative w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <div className="text-lg font-semibold text-gray-900">{title}</div>
          <button
            type="button"
            className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"
            onClick={onClose}
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
      </div>
    </div>
  );
}

// ============================================
// BRACKET COMPONENTS
// ============================================

type MatchCardProps = {
  match: EventBracketMatch;
  teams: Team[];
  size?: "sm" | "md" | "lg";
  highlight?: boolean;
  variant?: "default" | "semi" | "final";
  onContextMenu: (e: React.MouseEvent) => void;
};

function MatchCard({ match, teams, size = "sm", highlight = false, variant = "default", onContextMenu }: MatchCardProps) {
  const team1 = match.team1Id ? teams.find((t) => t.id === match.team1Id) ?? null : null;
  const team2 = match.team2Id ? teams.find((t) => t.id === match.team2Id) ?? null : null;

  const sizeClasses = {
    sm: "py-2",
    md: "py-2.5",
    lg: "py-3",
  };

  const getTeamLogo = (team: Team | null) => {
    if (!team) return "?";
    if (team.logoUrl) {
      return <img src={team.logoUrl} alt="" className="h-5 w-5 rounded object-cover" />;
    }
    return "⚽";
  };

  const variantClasses = {
    default: "bg-white border-gray-200 hover:border-amber-300",
    semi: "bg-gradient-to-br from-emerald-50 to-cyan-50 border-emerald-200 hover:border-emerald-400",
    final: "bg-gradient-to-br from-amber-50 to-orange-50 border-amber-300 hover:border-amber-500 shadow-md",
  };

  return (
    <div
      className={`min-w-[140px] cursor-context-menu overflow-hidden rounded-xl border transition-all ${variantClasses[highlight ? "final" : variant]}`}
      onContextMenu={onContextMenu}
    >
      <div className={`flex items-center gap-2 px-3 ${sizeClasses[size]} hover:bg-gray-50`}>
        <span className="flex h-6 w-6 items-center justify-center rounded bg-gray-100 text-xs">
          {getTeamLogo(team1)}
        </span>
        <span className="flex-1 truncate text-sm font-medium text-gray-900">
          {team1?.nameEn ?? "TBD"}
        </span>
        <span className="min-w-[24px] text-center text-sm font-bold text-amber-600">
          {match.score1 ?? "-"}
        </span>
      </div>
      <div className="h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent" />
      <div className={`flex items-center gap-2 px-3 ${sizeClasses[size]} hover:bg-gray-50`}>
        <span className="flex h-6 w-6 items-center justify-center rounded bg-gray-100 text-xs">
          {getTeamLogo(team2)}
        </span>
        <span className="flex-1 truncate text-sm font-medium text-gray-900">
          {team2?.nameEn ?? "TBD"}
        </span>
        <span className="min-w-[24px] text-center text-sm font-bold text-amber-600">
          {match.score2 ?? "-"}
        </span>
      </div>
    </div>
  );
}

type WinnerCardProps = {
  teamId: string | null;
  teams: Team[];
  onContextMenu: (e: React.MouseEvent) => void;
};

function WinnerCard({ teamId, teams, onContextMenu }: WinnerCardProps) {
  const team = teamId ? teams.find((t) => t.id === teamId) : null;

  return (
    <div
      className="flex min-w-[120px] cursor-context-menu items-center justify-center rounded-lg border border-emerald-200 bg-gradient-to-br from-emerald-50 to-teal-50 px-4 py-3 transition-all hover:border-emerald-400"
      onContextMenu={onContextMenu}
    >
      <span className="text-sm font-semibold text-emerald-700">
        {team?.nameEn ?? "Winner"}
      </span>
    </div>
  );
}

type GroupSelectorProps = {
  side: "left" | "right";
  groupId: string | null;
  groups: Group[];
  onContextMenu: (e: React.MouseEvent) => void;
};

function GroupSelector({ side, groupId, groups, onContextMenu }: GroupSelectorProps) {
  const group = groupId ? groups.find((g) => g.id === groupId) : null;

  return (
    <button
      className="rounded-lg border border-dashed border-gray-300 bg-gray-50 px-4 py-2 text-sm font-medium text-gray-600 transition-all hover:border-blue-400 hover:bg-blue-50 hover:text-blue-700"
      onContextMenu={onContextMenu}
      onClick={onContextMenu}
    >
      {group ? group.name : `Set ${side === "left" ? "Left" : "Right"} Group`}
    </button>
  );
}

// ============================================
// MAIN BRACKET TREE
// ============================================

type BracketTreeProps = {
  bracket: EventBracketState;
  teams: Team[];
  groups: Group[];
  onMatchContext: (e: React.MouseEvent, matchId: string, round: "round1" | "semi" | "third" | "final", side?: "left" | "right") => void;
  onWinnerContext: (e: React.MouseEvent, winnerId: string, side: "left" | "right") => void;
  onGroupContext: (e: React.MouseEvent, side: "left" | "right") => void;
};

function BracketTree({ bracket, teams, groups, onMatchContext, onWinnerContext, onGroupContext }: BracketTreeProps) {
  return (
    <div className="overflow-x-auto pb-4">
      <div className="flex min-w-[1100px] items-center justify-center gap-6 px-4 py-8">
        {/* LEFT SIDE */}
        <div className="flex items-center gap-6">
          {/* Round 1 - Left */}
          <div className="flex flex-col gap-3">
            <div className="mb-2 text-center">
              <GroupSelector
                side="left"
                groupId={bracket.leftSide.groupId}
                groups={groups}
                onContextMenu={(e) => onGroupContext(e, "left")}
              />
            </div>
            {bracket.leftSide.round1Matches.map((match) => (
              <MatchCard
                key={match.id}
                match={match}
                teams={teams}
                size="sm"
                onContextMenu={(e) => onMatchContext(e, match.id, "round1", "left")}
              />
            ))}
          </div>

          {/* Winner Slots - Left */}
          <div className="flex flex-col justify-around gap-8 py-8">
            {bracket.leftSide.winnerSlots.map((slot) => (
              <WinnerCard
                key={slot.id}
                teamId={slot.teamId}
                teams={teams}
                onContextMenu={(e) => onWinnerContext(e, slot.id, "left")}
              />
            ))}
          </div>
        </div>

        {/* CENTER - Semi Finals + Finals */}
        <div className="flex flex-col items-center gap-6 px-4">
          {/* Semi Final 1 */}
          <div className="text-center">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
              Semi Final
            </div>
            <MatchCard
              match={bracket.semiFinals[0]}
              teams={teams}
              size="md"
              variant="semi"
              onContextMenu={(e) => onMatchContext(e, bracket.semiFinals[0].id, "semi")}
            />
          </div>

          {/* Finals Row */}
          <div className="flex items-start gap-6">
            {/* Grand Final */}
            <div className="text-center">
              <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-amber-600">
                🏆 Grand Final
              </div>
              <MatchCard
                match={bracket.final}
                teams={teams}
                size="lg"
                highlight
                variant="final"
                onContextMenu={(e) => onMatchContext(e, bracket.final.id, "final")}
              />
            </div>

            {/* 3rd Place */}
            <div className="text-center">
              <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-violet-500">
                3rd Place
              </div>
              <MatchCard
                match={bracket.thirdPlace}
                teams={teams}
                size="md"
                onContextMenu={(e) => onMatchContext(e, bracket.thirdPlace.id, "third")}
              />
            </div>
          </div>

          {/* Semi Final 2 */}
          <div className="text-center">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
              Semi Final
            </div>
            <MatchCard
              match={bracket.semiFinals[1]}
              teams={teams}
              size="md"
              variant="semi"
              onContextMenu={(e) => onMatchContext(e, bracket.semiFinals[1].id, "semi")}
            />
          </div>
        </div>

        {/* RIGHT SIDE */}
        <div className="flex items-center gap-6">
          {/* Winner Slots - Right */}
          <div className="flex flex-col justify-around gap-8 py-8">
            {bracket.rightSide.winnerSlots.map((slot) => (
              <WinnerCard
                key={slot.id}
                teamId={slot.teamId}
                teams={teams}
                onContextMenu={(e) => onWinnerContext(e, slot.id, "right")}
              />
            ))}
          </div>

          {/* Round 1 - Right */}
          <div className="flex flex-col gap-3">
            <div className="mb-2 text-center">
              <GroupSelector
                side="right"
                groupId={bracket.rightSide.groupId}
                groups={groups}
                onContextMenu={(e) => onGroupContext(e, "right")}
              />
            </div>
            {bracket.rightSide.round1Matches.map((match) => (
              <MatchCard
                key={match.id}
                match={match}
                teams={teams}
                size="sm"
                onContextMenu={(e) => onMatchContext(e, match.id, "round1", "right")}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================
// MAIN COMPONENT
// ============================================

export default function TournamentEvent() {
  const { user } = useAuth();
  const { tournamentId, tournament } = useTournamentManager();
  const actor = user
    ? { userId: user.uid, userEmail: user.email ?? null }
    : undefined;

  // Data state
  const [teams, setTeams] = useState<Team[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [bracket, setBracket] = useState<EventBracketState | null>(null);
  const [groupMatches, setGroupMatches] = useState<TournamentMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // UI state
  const [contextMenu, setContextMenu] = useState<ContextMenuState>(null);
  const [scoreModal, setScoreModal] = useState<{
    matchId: string;
    round: string;
    side?: "left" | "right";
  } | null>(null);
  const [score1, setScore1] = useState("");
  const [score2, setScore2] = useState("");

  // Group Match Modal State
  const [createMatchModal, setCreateMatchModal] = useState<{ groupId: string } | null>(null);
  const [editMatchModal, setEditMatchModal] = useState<TournamentMatch | null>(null);
  const [matchForm, setMatchForm] = useState({
    team1Id: "",
    team2Id: "",
    date: "",
    time: "",
    score1: "",
    score2: "",
  });
  const [matchSaving, setMatchSaving] = useState(false);

  // Load data
  useEffect(() => {
    let mounted = true;
    let unsubTeams: (() => void) | undefined;
    let unsubGroups: (() => void) | undefined;
    let unsubBracket: (() => void) | undefined;
    let unsubMatches: (() => void) | undefined;

    const loaded = { teams: false, groups: false, bracket: false, matches: false };
    const checkLoaded = () => {
      if (loaded.teams && loaded.groups && loaded.bracket && loaded.matches && mounted) {
        setLoading(false);
      }
    };

    void (async () => {
      try {
        unsubTeams = await subscribeToTournamentTeams(
          tournamentId,
          (items) => {
            if (!mounted) return;
            setTeams(items);
            loaded.teams = true;
            checkLoaded();
          },
          () => {
            loaded.teams = true;
            checkLoaded();
          }
        );

        unsubGroups = await subscribeToTournamentGroups(
          tournamentId,
          (items) => {
            if (!mounted) return;
            setGroups(items);
            loaded.groups = true;
            checkLoaded();
          },
          () => {
            loaded.groups = true;
            checkLoaded();
          }
        );

        unsubBracket = await subscribeToEventBracketState(
          tournamentId,
          (state) => {
            if (!mounted) return;
            setBracket(state ?? generateInitialBracket());
            loaded.bracket = true;
            checkLoaded();
          },
          () => {
            if (!mounted) return;
            setBracket(generateInitialBracket());
            loaded.bracket = true;
            checkLoaded();
          }
        );

        unsubMatches = await subscribeToTournamentMatches(
          tournamentId,
          (items) => {
            if (!mounted) return;
            setGroupMatches(items);
            loaded.matches = true;
            checkLoaded();
          },
          () => {
            loaded.matches = true;
            checkLoaded();
          }
        );
      } catch (err) {
        console.error("[Event] Failed to load data", err);
        if (mounted) {
          setBracket(generateInitialBracket());
          setLoading(false);
        }
      }
    })();

    return () => {
      mounted = false;
      unsubTeams?.();
      unsubGroups?.();
      unsubBracket?.();
      unsubMatches?.();
    };
  }, [tournamentId]);

  // Save bracket helper
  const saveBracket = useCallback(
    async (newBracket: EventBracketState) => {
      setSaving(true);
      try {
        await saveEventBracketState({ tournamentId, bracket: newBracket, actor });
      } catch (err) {
        console.error("[Event] Failed to save bracket", err);
      } finally {
        setSaving(false);
      }
    },
    [tournamentId, actor]
  );

  // Context menu handlers
  const handleMatchContext = useCallback(
    (e: React.MouseEvent, matchId: string, round: "round1" | "semi" | "third" | "final", side?: "left" | "right") => {
      e.preventDefault();
      setContextMenu({ x: e.clientX, y: e.clientY, type: "match", matchId, round, side });
    },
    []
  );

  const handleWinnerContext = useCallback(
    (e: React.MouseEvent, winnerId: string, side: "left" | "right") => {
      e.preventDefault();
      setContextMenu({ x: e.clientX, y: e.clientY, type: "winner", winnerId, side });
    },
    []
  );

  const handleGroupContext = useCallback(
    (e: React.MouseEvent, side: "left" | "right") => {
      e.preventDefault();
      setContextMenu({ x: e.clientX, y: e.clientY, type: "group", side });
    },
    []
  );

  // Action handlers
  const handleAssignTeam = useCallback(
    (matchId: string, slot: 1 | 2, teamId: string | null, round: string, side?: "left" | "right") => {
      if (!bracket) return;

      const newBracket = { ...bracket };
      const updateMatch = (match: EventBracketMatch) => {
        if (slot === 1) {
          match.team1Id = teamId;
        } else {
          match.team2Id = teamId;
        }
      };

      if (round === "round1" && side) {
        const sideData = side === "left" ? newBracket.leftSide : newBracket.rightSide;
        const match = sideData.round1Matches.find((m) => m.id === matchId);
        if (match) updateMatch(match);
      } else if (round === "semi") {
        const match = newBracket.semiFinals.find((m) => m.id === matchId);
        if (match) updateMatch(match);
      } else if (round === "third") {
        updateMatch(newBracket.thirdPlace);
      } else if (round === "final") {
        updateMatch(newBracket.final);
      }

      setBracket(newBracket);
      void saveBracket(newBracket);
    },
    [bracket, saveBracket]
  );

  const handleSetGroup = useCallback(
    (side: "left" | "right", groupId: string | null) => {
      if (!bracket) return;

      const newBracket = { ...bracket };
      if (side === "left") {
        newBracket.leftSide = { ...newBracket.leftSide, groupId };
      } else {
        newBracket.rightSide = { ...newBracket.rightSide, groupId };
      }

      setBracket(newBracket);
      void saveBracket(newBracket);
    },
    [bracket, saveBracket]
  );

  const handleSetWinner = useCallback(
    (winnerId: string, side: "left" | "right", teamId: string | null) => {
      if (!bracket) return;

      const newBracket = { ...bracket };
      const sideData = side === "left" ? newBracket.leftSide : newBracket.rightSide;
      const slot = sideData.winnerSlots.find((s) => s.id === winnerId);
      if (slot) {
        slot.teamId = teamId;
      }

      setBracket(newBracket);
      void saveBracket(newBracket);
    },
    [bracket, saveBracket]
  );

  const handleClearMatch = useCallback(
    (matchId: string, round: string, side?: "left" | "right") => {
      if (!bracket) return;

      const newBracket = { ...bracket };
      const clearMatch = (match: EventBracketMatch) => {
        match.team1Id = null;
        match.team2Id = null;
        match.score1 = null;
        match.score2 = null;
        match.winnerId = null;
        match.status = "pending";
      };

      if (round === "round1" && side) {
        const sideData = side === "left" ? newBracket.leftSide : newBracket.rightSide;
        const match = sideData.round1Matches.find((m) => m.id === matchId);
        if (match) clearMatch(match);
      } else if (round === "semi") {
        const match = newBracket.semiFinals.find((m) => m.id === matchId);
        if (match) clearMatch(match);
      } else if (round === "third") {
        clearMatch(newBracket.thirdPlace);
      } else if (round === "final") {
        clearMatch(newBracket.final);
      }

      setBracket(newBracket);
      void saveBracket(newBracket);
    },
    [bracket, saveBracket]
  );

  const handleOpenScoreModal = useCallback(
    (matchId: string, round: string, side?: "left" | "right") => {
      if (!bracket) return;

      let match: EventBracketMatch | null = null;

      if (round === "round1" && side) {
        const sideData = side === "left" ? bracket.leftSide : bracket.rightSide;
        match = sideData.round1Matches.find((m) => m.id === matchId) ?? null;
      } else if (round === "semi") {
        match = bracket.semiFinals.find((m) => m.id === matchId) ?? null;
      } else if (round === "third") {
        match = bracket.thirdPlace;
      } else if (round === "final") {
        match = bracket.final;
      }

      setScore1(match?.score1?.toString() ?? "");
      setScore2(match?.score2?.toString() ?? "");
      setScoreModal({ matchId, round, side });
    },
    [bracket]
  );

  const handleSaveScore = useCallback(() => {
    if (!bracket || !scoreModal) return;

    const newBracket = { ...bracket };
    const s1 = score1 === "" ? null : parseInt(score1, 10);
    const s2 = score2 === "" ? null : parseInt(score2, 10);

    const updateScore = (match: EventBracketMatch) => {
      match.score1 = isNaN(s1 as number) ? null : s1;
      match.score2 = isNaN(s2 as number) ? null : s2;
      if (s1 !== null && s2 !== null && !isNaN(s1) && !isNaN(s2)) {
        match.status = "finished";
        match.winnerId = s1 > s2 ? match.team1Id : s2 > s1 ? match.team2Id : null;
      }
    };

    const { matchId, round, side } = scoreModal;

    if (round === "round1" && side) {
      const sideData = side === "left" ? newBracket.leftSide : newBracket.rightSide;
      const match = sideData.round1Matches.find((m) => m.id === matchId);
      if (match) updateScore(match);
    } else if (round === "semi") {
      const match = newBracket.semiFinals.find((m) => m.id === matchId);
      if (match) updateScore(match);
    } else if (round === "third") {
      updateScore(newBracket.thirdPlace);
    } else if (round === "final") {
      updateScore(newBracket.final);
    }

    setBracket(newBracket);
    void saveBracket(newBracket);
    setScoreModal(null);
  }, [bracket, scoreModal, score1, score2, saveBracket]);

  const handleResetBracket = useCallback(() => {
    if (!confirm("Are you sure you want to reset the entire bracket? This cannot be undone.")) {
      return;
    }
    const newBracket = generateInitialBracket();
    setBracket(newBracket);
    void saveBracket(newBracket);
  }, [saveBracket]);

  // Group Match Handlers
  const openCreateMatchModal = useCallback((groupId: string) => {
    setMatchForm({ team1Id: "", team2Id: "", date: "", time: "", score1: "", score2: "" });
    setCreateMatchModal({ groupId });
  }, []);

  const openEditMatchModal = useCallback((match: TournamentMatch) => {
    const scheduledDate = match.scheduledAt?.toDate();
    setMatchForm({
      team1Id: match.team1Id,
      team2Id: match.team2Id,
      date: scheduledDate ? scheduledDate.toISOString().split("T")[0] : "",
      time: scheduledDate ? scheduledDate.toTimeString().slice(0, 5) : "",
      score1: match.score1?.toString() ?? "",
      score2: match.score2?.toString() ?? "",
    });
    setEditMatchModal(match);
  }, []);

  const handleCreateMatch = useCallback(async () => {
    if (!createMatchModal || !matchForm.team1Id || !matchForm.team2Id) return;
    if (matchForm.team1Id === matchForm.team2Id) {
      alert("Team 1 and Team 2 cannot be the same.");
      return;
    }

    setMatchSaving(true);
    try {
      let scheduledAt: Date | null = null;
      if (matchForm.date && matchForm.time) {
        scheduledAt = new Date(`${matchForm.date}T${matchForm.time}`);
      } else if (matchForm.date) {
        scheduledAt = new Date(`${matchForm.date}T00:00`);
      }

      await createTournamentMatch({
        tournamentId,
        groupId: createMatchModal.groupId,
        team1Id: matchForm.team1Id,
        team2Id: matchForm.team2Id,
        scheduledAt,
        actor,
      });
      setCreateMatchModal(null);
    } catch (err) {
      console.error("[Event] Failed to create match", err);
      alert("Failed to create match.");
    } finally {
      setMatchSaving(false);
    }
  }, [createMatchModal, matchForm, tournamentId]);

  const handleUpdateMatch = useCallback(async () => {
    if (!editMatchModal || !matchForm.team1Id || !matchForm.team2Id) return;
    if (matchForm.team1Id === matchForm.team2Id) {
      alert("Team 1 and Team 2 cannot be the same.");
      return;
    }

    setMatchSaving(true);
    try {
      let scheduledAt: Date | null = null;
      if (matchForm.date && matchForm.time) {
        scheduledAt = new Date(`${matchForm.date}T${matchForm.time}`);
      } else if (matchForm.date) {
        scheduledAt = new Date(`${matchForm.date}T00:00`);
      }

      // Update basic match info
      await updateTournamentMatch({
        tournamentId,
        matchId: editMatchModal.id,
        groupId: editMatchModal.groupId,
        team1Id: matchForm.team1Id,
        team2Id: matchForm.team2Id,
        scheduledAt,
        actor,
      });

      // If scores are provided, set the result
      const s1 = matchForm.score1 === "" ? null : parseInt(matchForm.score1, 10);
      const s2 = matchForm.score2 === "" ? null : parseInt(matchForm.score2, 10);
      if (s1 !== null && s2 !== null && !isNaN(s1) && !isNaN(s2)) {
        await setTournamentMatchResult({
          tournamentId,
          matchId: editMatchModal.id,
          team1Id: matchForm.team1Id,
          team2Id: matchForm.team2Id,
          score1: s1,
          score2: s2,
          actor,
        });
      }

      setEditMatchModal(null);
    } catch (err) {
      console.error("[Event] Failed to update match", err);
      alert("Failed to update match.");
    } finally {
      setMatchSaving(false);
    }
  }, [editMatchModal, matchForm, tournamentId, actor]);

  const handleDeleteMatch = useCallback(async (matchId: string) => {
    if (!confirm("Are you sure you want to delete this match?")) return;

    try {
      await deleteTournamentMatch({ tournamentId, matchId, actor });
    } catch (err) {
      console.error("[Event] Failed to delete match", err);
      alert("Failed to delete match.");
    }
  }, [tournamentId, actor]);

  // Get matches for a specific group
  const getMatchesForGroup = useCallback(
    (groupId: string) => {
      return groupMatches
        .filter((m) => m.groupId === groupId)
        .sort((a, b) => {
          // Sort by scheduled date if available, otherwise by creation date
          const aDate = a.scheduledAt?.toDate().getTime() ?? a.createdAt?.toDate().getTime() ?? 0;
          const bDate = b.scheduledAt?.toDate().getTime() ?? b.createdAt?.toDate().getTime() ?? 0;
          return aDate - bDate;
        });
    },
    [groupMatches]
  );

  // Get team name helper
  const getTeamName = useCallback(
    (teamId: string) => {
      return teams.find((t) => t.id === teamId)?.nameEn ?? "Unknown Team";
    },
    [teams]
  );

  // Get teams for a group
  const getTeamsForGroup = useCallback(
    (groupId: string) => {
      const group = groups.find((g) => g.id === groupId);
      if (!group) return [];
      return teams.filter((t) => group.teamIds.includes(t.id));
    },
    [groups, teams]
  );

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-gray-500">Loading event bracket...</div>
      </div>
    );
  }

  if (!bracket) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-6">
        <p className="text-gray-700">Failed to load bracket data.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-2xl border border-gray-200 bg-white p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Event Bracket</h1>
            <p className="mt-1 text-sm text-gray-600">
              Right-click on matches, winner slots, or group buttons to manage the bracket.
            </p>
          </div>
          <div className="flex items-center gap-3">
            {saving && (
              <span className="text-sm text-gray-500">Saving...</span>
            )}
            <button
              type="button"
              className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-100"
              onClick={handleResetBracket}
            >
              Reset Bracket
            </button>
          </div>
        </div>
      </div>

      {/* Bracket */}
      <div className="rounded-2xl border border-gray-200 bg-gradient-to-br from-gray-50 to-slate-100 p-6">
        <div className="mb-6 text-center">
          <div className="text-4xl">🏆</div>
          <h2 className="mt-2 text-2xl font-bold tracking-wide text-gray-900">
            {tournament.nameEn}
          </h2>
          <p className="mt-1 text-sm text-gray-500">Tournament Bracket</p>
        </div>

        <BracketTree
          bracket={bracket}
          teams={teams}
          groups={groups}
          onMatchContext={handleMatchContext}
          onWinnerContext={handleWinnerContext}
          onGroupContext={handleGroupContext}
        />
      </div>

      {/* Instructions */}
      <div className="rounded-2xl border border-gray-200 bg-white p-6">
        <h3 className="text-sm font-semibold text-gray-900">How to use the bracket</h3>
        <ul className="mt-3 space-y-2 text-sm text-gray-600">
          <li className="flex items-start gap-2">
            <span className="mt-0.5 h-1.5 w-1.5 rounded-full bg-blue-500" />
            <span><strong>Set Groups:</strong> Click or right-click the group buttons above each side to assign a group. Teams from that group will be available for matches.</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-0.5 h-1.5 w-1.5 rounded-full bg-emerald-500" />
            <span><strong>Assign Teams:</strong> Right-click on any match card to assign Team 1 or Team 2 from the available teams.</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-0.5 h-1.5 w-1.5 rounded-full bg-amber-500" />
            <span><strong>Set Scores:</strong> Right-click on a match and select "Set Score" to enter the final score.</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-0.5 h-1.5 w-1.5 rounded-full bg-violet-500" />
            <span><strong>Winner Slots:</strong> Right-click on winner slots to manually set which teams advance.</span>
          </li>
        </ul>
      </div>

      {/* ============================================
          SECTION 2: GROUP STAGE MATCHES
          ============================================ */}
      <div className="rounded-2xl border border-gray-200 bg-white p-6">
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-gray-900">Group Stage Matches</h2>
          <p className="mt-1 text-sm text-gray-600">
            Create and manage matches for each group. Set the date, time, teams, and update scores.
          </p>
        </div>

        {groups.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-8 text-center">
            <div className="mx-auto h-12 w-12 rounded-full bg-gray-100 flex items-center justify-center">
              <svg className="h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <h3 className="mt-4 text-sm font-medium text-gray-900">No groups yet</h3>
            <p className="mt-2 text-sm text-gray-600">
              Create groups in the Groups tab first, then come back to manage matches.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {groups.map((group) => {
              const groupTeams = getTeamsForGroup(group.id);
              const matches = getMatchesForGroup(group.id);

              return (
                <div key={group.id} className="rounded-xl border border-gray-200 overflow-hidden">
                  {/* Group Header */}
                  <div className="flex items-center justify-between bg-gradient-to-r from-slate-50 to-gray-50 px-4 py-3 border-b border-gray-200">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100 text-sm font-bold text-blue-700">
                        {group.name.charAt(0)}
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900">{group.name}</h3>
                        <p className="text-xs text-gray-500">{groupTeams.length} teams • {matches.length} matches</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
                      onClick={() => openCreateMatchModal(group.id)}
                      disabled={groupTeams.length < 2}
                      title={groupTeams.length < 2 ? "Add at least 2 teams to create matches" : "Create a new match"}
                    >
                      + Add Match
                    </button>
                  </div>

                  {/* Matches List */}
                  <div className="divide-y divide-gray-100">
                    {matches.length === 0 ? (
                      <div className="px-4 py-8 text-center text-sm text-gray-500">
                        No matches yet. Click "Add Match" to create one.
                      </div>
                    ) : (
                      matches.map((match) => {
                        const team1 = teams.find((t) => t.id === match.team1Id);
                        const team2 = teams.find((t) => t.id === match.team2Id);
                        const scheduledDate = match.scheduledAt?.toDate();

                        return (
                          <div
                            key={match.id}
                            className="flex items-center gap-4 px-4 py-3 hover:bg-gray-50 transition-colors"
                          >
                            {/* Date/Time */}
                            <div className="w-24 shrink-0 text-center">
                              {scheduledDate ? (
                                <>
                                  <div className="text-xs font-medium text-gray-900">
                                    {scheduledDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                                  </div>
                                  <div className="text-xs text-gray-500">
                                    {scheduledDate.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                                  </div>
                                </>
                              ) : (
                                <div className="text-xs text-gray-400">TBD</div>
                              )}
                            </div>

                            {/* Teams */}
                            <div className="flex flex-1 items-center justify-center gap-3">
                              {/* Team 1 */}
                              <div className="flex items-center gap-2 min-w-[120px] justify-end">
                                <span className="text-sm font-medium text-gray-900 truncate">
                                  {team1?.nameEn ?? "TBD"}
                                </span>
                                {team1?.logoUrl && (
                                  <img src={team1.logoUrl} alt="" className="h-6 w-6 rounded object-cover" />
                                )}
                              </div>

                              {/* Score */}
                              <div className="flex items-center gap-2 px-3 py-1 rounded-lg bg-gray-100 min-w-[80px] justify-center">
                                <span className={`text-lg font-bold ${match.status === "finished" ? "text-gray-900" : "text-gray-400"}`}>
                                  {match.score1 ?? "-"}
                                </span>
                                <span className="text-gray-400">:</span>
                                <span className={`text-lg font-bold ${match.status === "finished" ? "text-gray-900" : "text-gray-400"}`}>
                                  {match.score2 ?? "-"}
                                </span>
                              </div>

                              {/* Team 2 */}
                              <div className="flex items-center gap-2 min-w-[120px]">
                                {team2?.logoUrl && (
                                  <img src={team2.logoUrl} alt="" className="h-6 w-6 rounded object-cover" />
                                )}
                                <span className="text-sm font-medium text-gray-900 truncate">
                                  {team2?.nameEn ?? "TBD"}
                                </span>
                              </div>
                            </div>

                            {/* Status Badge */}
                            <div className="w-20 text-center">
                              <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${match.status === "finished"
                                ? "bg-emerald-100 text-emerald-700"
                                : "bg-amber-100 text-amber-700"
                                }`}>
                                {match.status === "finished" ? "Finished" : "Scheduled"}
                              </span>
                            </div>

                            {/* Actions */}
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-blue-600"
                                onClick={() => openEditMatchModal(match)}
                                title="Edit match"
                              >
                                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                              </button>
                              <button
                                type="button"
                                className="rounded-lg p-2 text-gray-500 hover:bg-red-50 hover:text-red-600"
                                onClick={() => handleDeleteMatch(match.id)}
                                title="Delete match"
                              >
                                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Context Menu */}
      <ContextMenu
        state={contextMenu}
        teams={teams}
        groups={groups}
        bracket={bracket}
        onClose={() => setContextMenu(null)}
        onAssignTeam={handleAssignTeam}
        onSetScore={handleOpenScoreModal}
        onSetGroup={handleSetGroup}
        onSetWinner={handleSetWinner}
        onClearMatch={handleClearMatch}
      />

      {/* Score Modal (for bracket) */}
      <Modal
        open={!!scoreModal}
        title="Set Match Score"
        onClose={() => setScoreModal(null)}
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Team 1 Score</label>
              <input
                type="number"
                min="0"
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                value={score1}
                onChange={(e) => setScore1(e.target.value)}
                placeholder="0"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Team 2 Score</label>
              <input
                type="number"
                min="0"
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                value={score2}
                onChange={(e) => setScore2(e.target.value)}
                placeholder="0"
              />
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <button
              type="button"
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              onClick={() => setScoreModal(null)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              onClick={handleSaveScore}
            >
              Save Score
            </button>
          </div>
        </div>
      </Modal>

      {/* Create Match Modal */}
      <Modal
        open={!!createMatchModal}
        title="Create Match"
        onClose={() => setCreateMatchModal(null)}
      >
        <div className="space-y-4">
          {createMatchModal && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Team 1</label>
                  <select
                    className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    value={matchForm.team1Id}
                    onChange={(e) => setMatchForm({ ...matchForm, team1Id: e.target.value })}
                  >
                    <option value="">Select team...</option>
                    {getTeamsForGroup(createMatchModal.groupId).map((team) => (
                      <option key={team.id} value={team.id} disabled={team.id === matchForm.team2Id}>
                        {team.nameEn}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Team 2</label>
                  <select
                    className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    value={matchForm.team2Id}
                    onChange={(e) => setMatchForm({ ...matchForm, team2Id: e.target.value })}
                  >
                    <option value="">Select team...</option>
                    {getTeamsForGroup(createMatchModal.groupId).map((team) => (
                      <option key={team.id} value={team.id} disabled={team.id === matchForm.team1Id}>
                        {team.nameEn}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Date</label>
                  <input
                    type="date"
                    className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    value={matchForm.date}
                    onChange={(e) => setMatchForm({ ...matchForm, date: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Time</label>
                  <input
                    type="time"
                    className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    value={matchForm.time}
                    onChange={(e) => setMatchForm({ ...matchForm, time: e.target.value })}
                  />
                </div>
              </div>

              <p className="text-xs text-gray-500">
                Scores start as "-" (not set). You can update them later by editing the match.
              </p>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                  onClick={() => setCreateMatchModal(null)}
                  disabled={matchSaving}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                  onClick={handleCreateMatch}
                  disabled={matchSaving || !matchForm.team1Id || !matchForm.team2Id}
                >
                  {matchSaving ? "Creating..." : "Create Match"}
                </button>
              </div>
            </>
          )}
        </div>
      </Modal>

      {/* Edit Match Modal */}
      <Modal
        open={!!editMatchModal}
        title="Edit Match"
        onClose={() => setEditMatchModal(null)}
      >
        <div className="space-y-4">
          {editMatchModal && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Team 1</label>
                  <select
                    className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    value={matchForm.team1Id}
                    onChange={(e) => setMatchForm({ ...matchForm, team1Id: e.target.value })}
                  >
                    <option value="">Select team...</option>
                    {(editMatchModal.groupId ? getTeamsForGroup(editMatchModal.groupId) : teams).map((team) => (
                      <option key={team.id} value={team.id} disabled={team.id === matchForm.team2Id}>
                        {team.nameEn}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Team 2</label>
                  <select
                    className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    value={matchForm.team2Id}
                    onChange={(e) => setMatchForm({ ...matchForm, team2Id: e.target.value })}
                  >
                    <option value="">Select team...</option>
                    {(editMatchModal.groupId ? getTeamsForGroup(editMatchModal.groupId) : teams).map((team) => (
                      <option key={team.id} value={team.id} disabled={team.id === matchForm.team1Id}>
                        {team.nameEn}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Date</label>
                  <input
                    type="date"
                    className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    value={matchForm.date}
                    onChange={(e) => setMatchForm({ ...matchForm, date: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Time</label>
                  <input
                    type="time"
                    className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    value={matchForm.time}
                    onChange={(e) => setMatchForm({ ...matchForm, time: e.target.value })}
                  />
                </div>
              </div>

              <div className="border-t border-gray-200 pt-4">
                <h4 className="text-sm font-medium text-gray-900 mb-3">Match Result</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      {getTeamName(matchForm.team1Id) || "Team 1"} Score
                    </label>
                    <input
                      type="number"
                      min="0"
                      className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      value={matchForm.score1}
                      onChange={(e) => setMatchForm({ ...matchForm, score1: e.target.value })}
                      placeholder="-"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      {getTeamName(matchForm.team2Id) || "Team 2"} Score
                    </label>
                    <input
                      type="number"
                      min="0"
                      className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      value={matchForm.score2}
                      onChange={(e) => setMatchForm({ ...matchForm, score2: e.target.value })}
                      placeholder="-"
                    />
                  </div>
                </div>
                <p className="mt-2 text-xs text-gray-500">
                  Leave scores empty to keep the match as "Scheduled". Fill both scores to mark as "Finished".
                </p>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                  onClick={() => setEditMatchModal(null)}
                  disabled={matchSaving}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                  onClick={handleUpdateMatch}
                  disabled={matchSaving || !matchForm.team1Id || !matchForm.team2Id}
                >
                  {matchSaving ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </>
          )}
        </div>
      </Modal>
    </div>
  );
}
